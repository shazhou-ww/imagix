#!/usr/bin/env bun
/**
 * Add Google IdP to existing Cognito User Pool and enable on App Client.
 * Reads all from root .env (Bun loads it when run from repo root).
 *
 * Usage: bun run cognito:add-google
 */

import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REGION = "us-east-1";
const DEFAULT_PROFILE = "AdministratorAccess-914369185440";

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function main() {
  const googleClientId = getEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  if (!googleClientId || !googleClientSecret) {
    console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment.");
    process.exit(1);
  }

  if (!process.env.AWS_PROFILE) process.env.AWS_PROFILE = DEFAULT_PROFILE;
  const client = new CognitoIdentityProviderClient({ region: REGION });

  const rootEnv = parseEnvFile(join(import.meta.dir, "..", ".env"));
  const userPoolId =
    getEnv("IMAGIX_USER_POOL_ID") ?? rootEnv.IMAGIX_USER_POOL_ID ?? getEnv("USER_POOL_ID") ?? rootEnv.USER_POOL_ID;
  const clientId =
    getEnv("IMAGIX_USER_POOL_CLIENT_ID") ??
    rootEnv.IMAGIX_USER_POOL_CLIENT_ID ??
    getEnv("USER_POOL_CLIENT_ID") ??
    rootEnv.USER_POOL_CLIENT_ID;

  if (!userPoolId || !clientId) {
    console.error("IMAGIX_USER_POOL_ID and IMAGIX_USER_POOL_CLIENT_ID (or USER_POOL_ID/USER_POOL_CLIENT_ID) not found in .env. Run cognito:setup first.");
    process.exit(1);
  }

  console.log("Creating Google Identity Provider...");
  await client.send(
    new CreateIdentityProviderCommand({
      UserPoolId: userPoolId,
      ProviderName: "Google",
      ProviderType: "Google",
      ProviderDetails: {
        client_id: googleClientId,
        client_secret: googleClientSecret,
        authorize_scopes: "openid email profile",
      },
      AttributeMapping: {
        email: "email",
        name: "name",
      },
    }),
  );
  console.log("  Done.");

  const current = await client.send(
    new DescribeUserPoolClientCommand({ UserPoolId: userPoolId, ClientId: clientId }),
  );
  const appClient = current.UserPoolClient;
  if (!appClient) {
    console.error("App client not found.");
    process.exit(1);
  }

  const providers = Array.from(new Set([...(appClient.SupportedIdentityProviders ?? []), "Google"]));
  await client.send(
    new UpdateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      ClientName: appClient.ClientName,
      SupportedIdentityProviders: providers,
      CallbackURLs: appClient.CallbackURLs ?? [],
      LogoutURLs: appClient.LogoutURLs ?? [],
      AllowedOAuthFlows: appClient.AllowedOAuthFlows ?? ["code"],
      AllowedOAuthScopes: appClient.AllowedOAuthScopes ?? ["openid", "email", "profile"],
      AllowedOAuthFlowsUserPoolClient: true,
    }),
  );
  console.log("  App client updated to support Google.");
  console.log("\nGoogle sign-in is now enabled. Restart the frontend if needed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

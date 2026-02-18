#!/usr/bin/env bun
/**
 * Create Cognito User Pool, App Client, Domain, and optionally Google IdP.
 * Reads env from root .env (Bun loads it when run from repo root).
 * Writes USER_POOL_ID, USER_POOL_CLIENT_ID, COGNITO_DOMAIN to root .env
 *
 * Usage: bun run cognito:setup
 */

import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolDomainCommand,
  CreateUserPoolClientCommand,
  CreateIdentityProviderCommand,
  type CreateUserPoolCommandOutput,
  type CreateUserPoolClientCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REGION = "us-east-1";
const DEFAULT_PROFILE = "AdministratorAccess-914369185440";
const POOL_NAME = "imagix-user-pool";
const CLIENT_NAME = "imagix-web";
const DOMAIN_PREFIX = "imagix-auth";

function getEnv(name: string, defaultValue: string): string {
  const v = process.env[name];
  return (v?.trim() ?? defaultValue).trim();
}

function getEnvOptional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v === "" ? undefined : v;
}

async function main() {
  const profile = getEnv("AWS_PROFILE", DEFAULT_PROFILE);
  const redirectSignIn =
    getEnv("IMAGIX_REDIRECT_SIGN_IN") ?? getEnv("REDIRECT_SIGN_IN", "http://localhost:5173/callback");
  const redirectSignOut =
    getEnv("IMAGIX_REDIRECT_SIGN_OUT") ?? getEnv("REDIRECT_SIGN_OUT", "http://localhost:5173");
  const googleClientId = getEnvOptional("GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnvOptional("GOOGLE_CLIENT_SECRET");

  if (googleClientId && !googleClientSecret) {
    console.error("GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set.");
    process.exit(1);
  }

  if (!process.env.AWS_PROFILE) process.env.AWS_PROFILE = profile;
  const client = new CognitoIdentityProviderClient({ region: REGION });

  console.log(`Using AWS profile: ${process.env.AWS_PROFILE}, region: ${REGION}`);
  console.log("Creating User Pool...");

  const poolResult: CreateUserPoolCommandOutput = await client.send(
    new CreateUserPoolCommand({
      PoolName: POOL_NAME,
      AutoVerifiedAttributes: ["email"],
      UsernameAttributes: ["email"],
      Schema: [
        { Name: "email", Required: true, Mutable: true },
        { Name: "name", Required: false, Mutable: true },
      ],
    }),
  );

  const userPoolId = poolResult.UserPool?.Id;
  if (!userPoolId) {
    console.error("Failed to get UserPool Id");
    process.exit(1);
  }
  console.log(`  User Pool ID: ${userPoolId}`);

  let domainPrefix = DOMAIN_PREFIX;
  for (let attempt = 0; attempt < 5; attempt++) {
    const tryDomain = attempt === 0 ? domainPrefix : `${DOMAIN_PREFIX}-${Date.now().toString(36)}`;
    try {
      await client.send(
        new CreateUserPoolDomainCommand({
          UserPoolId: userPoolId,
          Domain: tryDomain,
        }),
      );
      domainPrefix = tryDomain;
      break;
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === "InvalidParameterException" || err?.name === "ResourceConflictException") {
        continue;
      }
      throw e;
    }
  }

  const cognitoDomain = `${domainPrefix}.auth.${REGION}.amazoncognito.com`;
  console.log(`  Domain: ${cognitoDomain}`);

  if (googleClientId && googleClientSecret) {
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
      }),
    );
    console.log("  Google IdP created.");
  } else {
    console.log("  Skipping Google IdP (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to add).");
  }

  const supportedProviders: string[] = googleClientId ? ["Google"] : ["COGNITO"];
  console.log("Creating User Pool Client...");

  const clientResult: CreateUserPoolClientCommandOutput = await client.send(
    new CreateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientName: CLIENT_NAME,
      GenerateSecret: false,
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthFlows: ["code"],
      AllowedOAuthScopes: ["openid", "email", "profile"],
      CallbackURLs: [redirectSignIn],
      LogoutURLs: [redirectSignOut],
      SupportedIdentityProviders: supportedProviders,
    }),
  );

  const userPoolClientId = clientResult.UserPoolClient?.ClientId;
  if (!userPoolClientId) {
    console.error("Failed to get App Client Id");
    process.exit(1);
  }
  console.log(`  Client ID: ${userPoolClientId}`);

  const rootDir = join(import.meta.dir, "..");
  const envPath = join(rootDir, ".env");
  const examplePath = join(rootDir, ".env.example");
  const lines: string[] = existsSync(envPath)
    ? readFileSync(envPath, "utf-8").split("\n")
    : readFileSync(examplePath, "utf-8").split("\n");

  const updates: Record<string, string> = {
    IMAGIX_USER_POOL_ID: userPoolId,
    IMAGIX_USER_POOL_CLIENT_ID: userPoolClientId,
    IMAGIX_COGNITO_DOMAIN: cognitoDomain,
    IMAGIX_REDIRECT_SIGN_IN: redirectSignIn,
    IMAGIX_REDIRECT_SIGN_OUT: redirectSignOut,
  };

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      out.push(line);
      continue;
    }
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      const key = match[1];
      seen.add(key);
      if (key in updates) {
        out.push(`${key}=${updates[key as keyof typeof updates]}`);
        continue;
      }
    }
    out.push(line);
  }

  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }

  writeFileSync(envPath, out.join("\n") + "\n", "utf-8");
  console.log(`\nWrote ${envPath}:`);
  console.log(`  IMAGIX_USER_POOL_ID=${userPoolId}`);
  console.log(`  IMAGIX_USER_POOL_CLIENT_ID=${userPoolClientId}`);
  console.log(`  IMAGIX_COGNITO_DOMAIN=${cognitoDomain}`);

  if (!googleClientId) {
    console.log("\nTo enable Google login:");
    console.log("  1. Create OAuth 2.0 credentials in Google Cloud Console.");
    console.log("  2. Add redirect URI: https://" + cognitoDomain + "/oauth2/idpresponse");
    console.log("  3. Run: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun run scripts/cognito-add-google.ts");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

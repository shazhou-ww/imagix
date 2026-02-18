#!/usr/bin/env bun
/**
 * Fix Google IdP attribute mapping so Cognito receives email (fixes "attributes required: [email]").
 * Reads USER_POOL_ID from root .env. Run once after cognito:add-google.
 *
 * Usage: bun run scripts/cognito-fix-google-attributes.ts
 */

import {
  CognitoIdentityProviderClient,
  UpdateIdentityProviderCommand,
  DescribeIdentityProviderCommand,
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
  if (!process.env.AWS_PROFILE) process.env.AWS_PROFILE = DEFAULT_PROFILE;
  const client = new CognitoIdentityProviderClient({ region: REGION });

  const rootEnv = parseEnvFile(join(import.meta.dir, "..", ".env"));
  const userPoolId =
    getEnv("IMAGIX_USER_POOL_ID") ??
    rootEnv.IMAGIX_USER_POOL_ID ??
    getEnv("USER_POOL_ID") ??
    rootEnv.USER_POOL_ID;

  if (!userPoolId) {
    console.error("IMAGIX_USER_POOL_ID or USER_POOL_ID not found in root .env");
    process.exit(1);
  }

  const existing = await client.send(
    new DescribeIdentityProviderCommand({
      UserPoolId: userPoolId,
      ProviderName: "Google",
    }),
  );

  if (!existing.IdentityProvider?.ProviderDetails) {
    console.error("Google Identity Provider not found. Run cognito:add-google first.");
    process.exit(1);
  }

  await client.send(
    new UpdateIdentityProviderCommand({
      UserPoolId: userPoolId,
      ProviderName: "Google",
      ProviderDetails: existing.IdentityProvider.ProviderDetails,
      AttributeMapping: {
        email: "email",
        name: "name",
      },
    }),
  );

  console.log("Google IdP attribute mapping updated (email, name). Try sign-in again.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

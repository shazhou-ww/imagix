#!/usr/bin/env bun
/**
 * Run aws sso login using AWS_PROFILE from root .env.
 * Usage: bun run aws:login
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const envPath = join(root, ".env");

function getProfile(): string {
  if (process.env.AWS_PROFILE?.trim()) return process.env.AWS_PROFILE.trim();
  if (!existsSync(envPath)) {
    console.error("No .env found. Set AWS_PROFILE or create .env with AWS_PROFILE=...");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^AWS_PROFILE=(.*)$/);
    if (m) return m[1].trim();
  }
  console.error("AWS_PROFILE not found in .env");
  process.exit(1);
}

const profile = getProfile();
console.log("Using profile:", profile);
const proc = Bun.spawn(["aws", "sso", "login", "--profile", profile], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await proc.exited);

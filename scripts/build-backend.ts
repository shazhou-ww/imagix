#!/usr/bin/env bun
/**
 * Prepare backend for SAM build by copying built shared package.
 * Run from project root.
 */
import { mkdir, cp } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const sharedDir = join(root, "shared");
const sharedDist = join(sharedDir, "dist");
const backendNodeModules = join(
  root,
  "backend",
  "node_modules",
  "@imagix",
  "shared",
);

await mkdir(backendNodeModules, { recursive: true });
await cp(
  join(sharedDir, "package.json"),
  join(backendNodeModules, "package.json"),
);
await cp(sharedDist, join(backendNodeModules, "dist"), { recursive: true });
console.log("Copied @imagix/shared to backend/node_modules");

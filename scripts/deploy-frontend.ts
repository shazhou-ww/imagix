#!/usr/bin/env bun
/**
 * Build frontend, upload to S3, invalidate CloudFront.
 * Reads from root .env. Requires imagix-frontend stack (infra/frontend-hosting.yaml) deployed.
 *
 * Usage: bun run scripts/deploy-frontend.ts
 */

import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REGION = "us-east-1";
const STACK_NAME = "imagix-frontend";
const DEFAULT_PROFILE = "AdministratorAccess-914369185440";

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

async function getStackOutputs(): Promise<Record<string, string>> {
  if (!process.env.AWS_PROFILE) process.env.AWS_PROFILE = DEFAULT_PROFILE;
  const cf = new CloudFormationClient({ region: REGION });
  const { Stacks } = await cf.send(
    new DescribeStacksCommand({ StackName: STACK_NAME }),
  );
  const stack = Stacks?.[0];
  if (!stack?.Outputs) throw new Error(`Stack ${STACK_NAME} not found or no outputs. Deploy infra/frontend-hosting.yaml first.`);
  const out: Record<string, string> = {};
  for (const o of stack.Outputs) {
    if (o.OutputKey && o.OutputValue) out[o.OutputKey] = o.OutputValue;
  }
  return out;
}

function walkDir(dir: string, base = ""): { path: string; content: Buffer }[] {
  const results: { path: string; content: Buffer }[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...walkDir(full, rel));
    } else {
      results.push({ path: rel, content: readFileSync(full) });
    }
  }
  return results;
}

async function main() {
  const outputs = await getStackOutputs();
  const bucket = outputs.S3BucketName;
  const distributionId = outputs.CloudFrontDistributionId;
  if (!bucket || !distributionId) {
    throw new Error("Stack outputs must include S3BucketName and CloudFrontDistributionId");
  }

  console.log("Building frontend...");
  const proc = Bun.spawn(["bun", "run", "build:frontend"], {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
  });
  const exit = await proc.exited;
  if (exit !== 0) throw new Error("Frontend build failed");

  const distDir = join(import.meta.dir, "..", "frontend", "dist");
  const files = walkDir(distDir);
  const s3 = new S3Client({ region: REGION });
  const contentType = (p: string) => {
    if (p.endsWith(".html")) return "text/html; charset=utf-8";
    if (p.endsWith(".js")) return "application/javascript";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".json")) return "application/json";
    if (p.endsWith(".ico")) return "image/x-icon";
    if (p.endsWith(".svg")) return "image/svg+xml";
    if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
  };

  console.log("Uploading to S3...");
  for (const { path: rel, content } of files) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: rel,
        Body: content,
        ContentType: contentType(rel),
      }),
    );
    console.log("  ", rel);
  }

  const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  const toDelete = (list.Contents ?? [])
    .filter((o) => o.Key && !files.some((f) => f.path === o.Key))
    .map((o) => ({ Key: o.Key! }));
  if (toDelete.length > 0) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: toDelete },
    }));
    console.log("Removed old keys:", toDelete.length);
  }

  console.log("Invalidating CloudFront...");
  const cf = new CloudFrontClient({ region: REGION });
  await cf.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `deploy-${Date.now()}`,
        Paths: { Quantity: 1, Items: ["/*"] },
      },
    }),
  );

  console.log("Done. Frontend: https://imagix.shazhou.me");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

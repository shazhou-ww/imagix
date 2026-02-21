#!/usr/bin/env bun
/**
 * Create the `imagix` table in a local DynamoDB instance.
 *
 * Usage:
 *   bun run scripts/init-dynamodb-local.ts              # defaults to port 4513 (dev)
 *   bun run scripts/init-dynamodb-local.ts --port 4512  # test instance
 *   DYNAMODB_PORT=4512 bun run scripts/init-dynamodb-local.ts
 */

import {
  CreateTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";

const port = process.argv.includes("--port")
  ? process.argv[process.argv.indexOf("--port") + 1]
  : (process.env.DYNAMODB_PORT ?? "4513");

const endpoint = `http://127.0.0.1:${port}`;

const client = new DynamoDBClient({
  endpoint,
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

async function waitForDynamo(retries = 30, intervalMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.send(new ListTablesCommand({}));
      return;
    } catch {
      if (i === retries - 1)
        throw new Error(`DynamoDB not reachable at ${endpoint}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

async function createTable() {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: "imagix",
        BillingMode: "PAY_PER_REQUEST",
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
          { AttributeName: "gsi1pk", AttributeType: "S" },
          { AttributeName: "gsi1sk", AttributeType: "S" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "gsi1",
            KeySchema: [
              { AttributeName: "gsi1pk", KeyType: "HASH" },
              { AttributeName: "gsi1sk", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      }),
    );
    console.log(`✓ Created table "imagix" on ${endpoint}`);
  } catch (e) {
    if (e instanceof ResourceInUseException) {
      console.log(`✓ Table "imagix" already exists on ${endpoint}`);
    } else {
      throw e;
    }
  }
}

console.log(`Waiting for DynamoDB Local on ${endpoint}...`);
await waitForDynamo();
await createTable();

#!/usr/bin/env bun
/**
 * Initialize DynamoDB local with tables. Run after docker compose up.
 * Cross-platform: run with `bun run scripts/init-dynamodb-local.ts`
 */
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const ENDPOINT = "http://localhost:4512";
const TABLE_NAME = "imagix";
const MAX_WAIT_MS = 30_000;
const POLL_MS = 500;

const client = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: "us-east-1",
});

async function waitForDynamo(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log("DynamoDB local is up.");
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  throw new Error("Timeout waiting for DynamoDB local at " + ENDPOINT);
}

async function main(): Promise<void> {
  console.log("Waiting for DynamoDB local at", ENDPOINT, "...");
  await waitForDynamo();

  console.log("Creating imagix table...");
  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
          { AttributeName: "gsi1pk", AttributeType: "S" },
          { AttributeName: "gsi1sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
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
    console.log("Table imagix created.");
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err.name === "ResourceInUseException") {
      console.log("Table imagix already exists.");
    } else {
      throw e;
    }
  }

  console.log("DynamoDB local ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

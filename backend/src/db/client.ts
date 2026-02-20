import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Environment detection:
 *   DYNAMODB_ENDPOINT  — explicit override (e.g. http://localhost:4512)
 *   Otherwise          — default AWS SDK behaviour (prod / SST dev)
 */
const raw = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    region: "us-east-1",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
});

function getTableName(): string {
  // Prefer explicit env var (local dev / test)
  if (process.env.TABLE_NAME) return process.env.TABLE_NAME;
  // Try SST Resource link (deployed Lambda)
  try {
    const { Resource } = require("sst");
    if ((Resource as any).ImagixTable?.name) {
      return (Resource as any).ImagixTable.name;
    }
  } catch {
    // SST links not active
  }
  return "imagix";
}

export const docClient = DynamoDBDocumentClient.from(raw);
export const TABLE_NAME = getTableName();


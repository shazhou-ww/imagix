import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const raw = new DynamoDBClient({
  ...(process.env.AWS_SAM_LOCAL && {
    endpoint: "http://host.docker.internal:8000",
    region: "us-east-1",
  }),
});

export const docClient = DynamoDBDocumentClient.from(raw);
export const TABLE_NAME = process.env.TABLE_NAME ?? "imagix";

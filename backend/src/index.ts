import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  GenerateStoryRequestSchema,
  type GenerateStoryResponse,
} from "@imagix/shared";

const client = new DynamoDBClient({
  ...(process.env.AWS_SAM_LOCAL && {
    endpoint: "http://host.docker.internal:8000",
    region: "us-east-1",
  }),
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.STORIES_TABLE ?? "imagix-stories";

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/prod/, "") || "/";

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    if (path === "/api/stories" && method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const parseResult = GenerateStoryRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: parseResult.error.message }),
        };
      }

      const { prompt, genre } = parseResult.data;
      const id = `story-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();

      const story = {
        pk: `USER#${event.requestContext.authorizer?.claims?.sub ?? "anonymous"}`,
        sk: `STORY#${id}`,
        id,
        prompt,
        genre: genre ?? "fantasy",
        content: `[Placeholder] Story generated for: ${prompt}`,
        createdAt: now,
        updatedAt: now,
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: story,
        }),
      );

      const response: GenerateStoryResponse = {
        id,
        content: story.content,
        prompt,
        createdAt: now,
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(response),
      };
    }

    if (path === "/api/health" && method === "GET") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: "ok", service: "imagix-api" }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not Found" }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
    };
  }
}

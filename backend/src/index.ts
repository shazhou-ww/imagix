import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { WorldSchema, createId, EntityPrefix } from "@imagix/shared";
import { putWorld, listWorldsByUser, getWorld } from "./db/repository.js";

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/prod/, "") || "/";

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  const userId =
    event.requestContext.authorizer?.claims?.sub ?? "anonymous";

  try {
    if (path === "/api/worlds" && method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const id = createId(EntityPrefix.World);
      const now = new Date().toISOString();

      const world = WorldSchema.parse({
        id,
        userId,
        name: body.name ?? "Untitled World",
        description: body.description ?? "",
        settings: body.settings ?? "",
        epoch: body.epoch ?? "",
        createdAt: now,
        updatedAt: now,
      });

      await putWorld(world);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(world),
      };
    }

    if (path === "/api/worlds" && method === "GET") {
      const worlds = await listWorldsByUser(userId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(worlds),
      };
    }

    if (path.match(/^\/api\/worlds\/[\w-]+$/) && method === "GET") {
      const worldId = path.split("/").pop()!;
      const world = await getWorld(worldId);
      if (!world) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "World not found" }),
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(world),
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

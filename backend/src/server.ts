#!/usr/bin/env bun
/**
 * Local dev server — runs the Hono app directly on Bun's HTTP server.
 * Routes and middleware are identical to the Lambda handler.
 *
 * Environment variables:
 *   DYNAMODB_ENDPOINT — DynamoDB Local endpoint (default: http://localhost:4513)
 *   TABLE_NAME        — DynamoDB table name       (default: imagix)
 *   PORT              — server listen port         (default: 4511)
 */

import { createApp } from "./app.js";

import worldRoutes from "./routes/worlds.js";
import taxonomyRoutes from "./routes/taxonomy.js";
import attributeDefinitionRoutes from "./routes/attribute-definitions.js";
import characterRoutes from "./routes/characters.js";
import thingRoutes from "./routes/things.js";
import relationshipRoutes from "./routes/relationships.js";
import entityRelRoutes from "./routes/entity-relationships.js";
import eventRoutes from "./routes/events.js";
import eventLinkRoutes from "./routes/event-links.js";
import storyRoutes from "./routes/stories.js";
import userStoryRoutes from "./routes/user-stories.js";
import chapterRoutes from "./routes/chapters.js";
import { plotCreateListRoutes, plotCrudRoutes } from "./routes/plots.js";
import stateRoutes from "./routes/state.js";

const app = createApp();

app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "imagix-api", env: "local" }),
);

app.route("/api/worlds", worldRoutes);
app.route("/api/worlds/:worldId/taxonomy", taxonomyRoutes);
app.route("/api/worlds/:worldId/attribute-definitions", attributeDefinitionRoutes);
app.route("/api/worlds/:worldId/characters", characterRoutes);
app.route("/api/worlds/:worldId/things", thingRoutes);
app.route("/api/worlds/:worldId/relationships", relationshipRoutes);
app.route(
  "/api/worlds/:worldId/entities/:entityId/relationships",
  entityRelRoutes,
);
app.route("/api/worlds/:worldId/events", eventRoutes);
app.route("/api/worlds/:worldId/event-links", eventLinkRoutes);
app.route("/api/worlds/:worldId/stories", storyRoutes);
app.route("/api/stories", userStoryRoutes);
app.route("/api/stories/:storyId/chapters", chapterRoutes);
app.route(
  "/api/stories/:storyId/chapters/:chapterId/plots",
  plotCreateListRoutes,
);
app.route("/api/stories/:storyId/plots", plotCrudRoutes);
app.route(
  "/api/worlds/:worldId/entities/:entityId/state",
  stateRoutes,
);

app.notFound((c) => {
  console.log("[404]", c.req.method, c.req.path, c.req.url);
  return c.json({ error: "Not Found" }, 404);
});

const port = Number(process.env.PORT ?? 4511);
console.log(`🚀 imagix-api dev server on http://localhost:${port}`);
console.log(`   DynamoDB: ${process.env.DYNAMODB_ENDPOINT}`);
console.log(`   Table:    ${process.env.TABLE_NAME}`);

export default {
  port,
  fetch: app.fetch,
};

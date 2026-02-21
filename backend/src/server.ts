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

// Load root .env (Bun only auto-loads .env from CWD which is backend/)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
try {
  // import.meta.url = file:///…/backend/src/server.ts → go up 2 levels to project root
  const thisDir = new URL(".", import.meta.url).pathname;
  const rootEnv = resolve(thisDir, "..", "..", ".env");
  const lines = readFileSync(rootEnv, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* root .env may not exist */ }

import { createApp } from "./app.js";

import worldRoutes from "./routes/worlds.js";
import taxonomyRoutes from "./routes/taxonomy.js";
import attributeDefinitionRoutes from "./routes/attribute-definitions.js";
import characterRoutes from "./routes/characters.js";
import thingRoutes from "./routes/things.js";
import placeRoutes from "./routes/places.js";
import relationshipRoutes from "./routes/relationships.js";
import entityRelRoutes from "./routes/entity-relationships.js";
import eventRoutes from "./routes/events.js";
import eventLinkRoutes from "./routes/event-links.js";
import storyRoutes from "./routes/stories.js";
import userStoryRoutes from "./routes/user-stories.js";
import chapterRoutes from "./routes/chapters.js";
import { plotCreateListRoutes, plotCrudRoutes } from "./routes/plots.js";
import stateRoutes from "./routes/state.js";
import entityEventRoutes from "./routes/entity-events.js";
import templateRoutes from "./routes/templates.js";
import mcpRoutes from "./mcp/index.js";
import { wellKnownRoutes } from "./mcp/auth.js";

const app = createApp();

app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "imagix-api", env: "local" }),
);

// OAuth discovery metadata (must be at root /.well-known/)
app.route("/.well-known", wellKnownRoutes);

app.route("/api/worlds", worldRoutes);
app.route("/api/templates", templateRoutes);
app.route("/api/worlds/:worldId/taxonomy", taxonomyRoutes);
app.route("/api/worlds/:worldId/attribute-definitions", attributeDefinitionRoutes);
app.route("/api/worlds/:worldId/characters", characterRoutes);
app.route("/api/worlds/:worldId/things", thingRoutes);
app.route("/api/worlds/:worldId/places", placeRoutes);
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
app.route(
  "/api/worlds/:worldId/entities/:entityId/events",
  entityEventRoutes,
);

// MCP (Model Context Protocol) endpoint for AI agents
app.route("/mcp", mcpRoutes);

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

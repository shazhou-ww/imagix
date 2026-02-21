import { handle } from "hono/aws-lambda";
import { createApp } from "./app.js";
import { wellKnownRoutes } from "./mcp/auth.js";
import mcpRoutes from "./mcp/index.js";
import attributeDefinitionRoutes from "./routes/attribute-definitions.js";
import chapterRoutes from "./routes/chapters.js";
import characterRoutes from "./routes/characters.js";
import entityEventRoutes from "./routes/entity-events.js";
import entityRelRoutes from "./routes/entity-relationships.js";
import eventLinkRoutes from "./routes/event-links.js";
import eventRoutes from "./routes/events.js";
import placeRoutes from "./routes/places.js";
import { plotCreateListRoutes, plotCrudRoutes } from "./routes/plots.js";
import relationshipRoutes from "./routes/relationships.js";
import stateRoutes from "./routes/state.js";
import storyRoutes from "./routes/stories.js";
import taxonomyRoutes from "./routes/taxonomy.js";
import templateRoutes from "./routes/templates.js";
import thingRoutes from "./routes/things.js";
import userStoryRoutes from "./routes/user-stories.js";
import worldRoutes from "./routes/worlds.js";

const app = createApp();

app.get("/api/health", (c) => c.json({ status: "ok", service: "imagix-api" }));

// OAuth discovery metadata (must be at root /.well-known/)
app.route("/.well-known", wellKnownRoutes);

app.route("/api/worlds", worldRoutes);
app.route("/api/templates", templateRoutes);
app.route("/api/worlds/:worldId/taxonomy", taxonomyRoutes);
app.route(
  "/api/worlds/:worldId/attribute-definitions",
  attributeDefinitionRoutes,
);
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
app.route("/api/worlds/:worldId/entities/:entityId/state", stateRoutes);
app.route("/api/worlds/:worldId/entities/:entityId/events", entityEventRoutes);

// MCP (Model Context Protocol) endpoint for AI agents
app.route("/mcp", mcpRoutes);

app.notFound((c) => {
  console.log("[404]", c.req.method, c.req.path, c.req.url);
  return c.json({ error: "Not Found" }, 404);
});

export const handler = handle(app);

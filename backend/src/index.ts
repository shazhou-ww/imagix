import { handle } from "hono/aws-lambda";
import { createApp } from "./app.js";

import worldRoutes from "./routes/worlds.js";
import taxonomyRoutes from "./routes/taxonomy.js";
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
  c.json({ status: "ok", service: "imagix-api" }),
);

app.route("/api/worlds", worldRoutes);
app.route("/api/worlds/:worldId/taxonomy", taxonomyRoutes);
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

const honoHandler = handle(app);

/** Strip API Gateway stage prefix (e.g. /prod) from path so Hono routes match. */
export const handler = (event: any, context: any) => {
  let path = event?.path ?? "";
  const stage =
    event?.requestContext?.stage ??
    (path.startsWith("/prod/") ? "prod" : null);
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.slice(stage.length + 1) || "/";
    event = { ...event, path };
  }
  return honoHandler(event, context);
};

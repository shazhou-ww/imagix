import { Hono } from "hono";
import { CreateStoryBody, UpdateStoryBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/stories.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateStoryBody.parse(await c.req.json());
    const story = await ctrl.create(p(c, "worldId"), c.get("userId"), body);
    return c.json(story, 201);
  })
  .get("/", async (c) => {
    const stories = await ctrl.listByWorld(p(c, "worldId"));
    return c.json(stories);
  })
  .get("/:storyId", async (c) => {
    const story = await ctrl.getById(p(c, "worldId"), p(c, "storyId"));
    return c.json(story);
  })
  .put("/:storyId", async (c) => {
    const body = UpdateStoryBody.parse(await c.req.json());
    const story = await ctrl.update(p(c, "worldId"), p(c, "storyId"), body);
    return c.json(story);
  })
  .delete("/:storyId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "storyId"));
    return c.json({ ok: true });
  });

export default app;

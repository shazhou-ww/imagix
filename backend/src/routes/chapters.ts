import { Hono } from "hono";
import { CreateChapterBody, UpdateChapterBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/chapters.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateChapterBody.parse(await c.req.json());
    const chapter = await ctrl.create(p(c, "worldId"), p(c, "storyId"), body);
    return c.json(chapter, 201);
  })
  .get("/", async (c) => {
    const chapters = await ctrl.list(p(c, "storyId"));
    return c.json(chapters);
  })
  .get("/:chapterId", async (c) => {
    const chapter = await ctrl.getById(p(c, "storyId"), p(c, "chapterId"));
    return c.json(chapter);
  })
  .put("/:chapterId", async (c) => {
    const body = UpdateChapterBody.parse(await c.req.json());
    const chapter = await ctrl.update(p(c, "storyId"), p(c, "chapterId"), body);
    return c.json(chapter);
  })
  .delete("/:chapterId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "storyId"), p(c, "chapterId"));
    return c.json({ ok: true });
  });

export default app;

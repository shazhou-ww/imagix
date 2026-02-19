import { Hono } from "hono";
import { CreateWorldBody, UpdateWorldBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/worlds.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateWorldBody.parse(await c.req.json());
    const world = await ctrl.create(c.get("userId"), body);
    return c.json(world, 201);
  })
  .get("/", async (c) => {
    const worlds = await ctrl.list(c.get("userId"));
    return c.json(worlds);
  })
  .get("/:worldId", async (c) => {
    const world = await ctrl.getById(p(c, "worldId"));
    return c.json(world);
  })
  .put("/:worldId", async (c) => {
    const body = UpdateWorldBody.parse(await c.req.json());
    const world = await ctrl.update(p(c, "worldId"), body);
    return c.json(world);
  })
  .delete("/:worldId", async (c) => {
    await ctrl.remove(p(c, "worldId"));
    return c.json({ ok: true });
  });

export default app;

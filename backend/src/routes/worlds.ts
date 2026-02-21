import { Hono } from "hono";
import { CreateWorldBody, UpdateWorldBody, CreateTemplateBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/worlds.js";
import * as templateCtrl from "../controllers/templates.js";

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
  })
  .get("/:worldId/export", async (c) => {
    const data = await ctrl.exportWorld(p(c, "worldId"));
    return c.json(data);
  })
  .post("/:worldId/import", async (c) => {
    const body = await c.req.json();
    await ctrl.importWorld(p(c, "worldId"), body);
    return c.json({ ok: true });
  })
  .post("/:worldId/save-as-template", async (c) => {
    const body = CreateTemplateBody.parse(await c.req.json());
    const template = await templateCtrl.saveWorldAsTemplate(
      c.get("userId"),
      p(c, "worldId"),
      body,
    );
    return c.json(template, 201);
  });

export default app;

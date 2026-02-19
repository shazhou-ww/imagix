import { Hono } from "hono";
import { CreatePlotBody, UpdatePlotBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/plots.js";

const createListApp = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreatePlotBody.parse(await c.req.json());
    const plot = await ctrl.create(p(c, "storyId"), p(c, "chapterId"), body);
    return c.json(plot, 201);
  })
  .get("/", async (c) => {
    const plots = await ctrl.list(p(c, "storyId"));
    return c.json(plots);
  });

const crudApp = new Hono<AppEnv>()
  .use("*", auth)
  .get("/:plotId", async (c) => {
    const plot = await ctrl.getById(p(c, "storyId"), p(c, "plotId"));
    return c.json(plot);
  })
  .put("/:plotId", async (c) => {
    const body = UpdatePlotBody.parse(await c.req.json());
    const plot = await ctrl.update(p(c, "storyId"), p(c, "plotId"), body);
    return c.json(plot);
  })
  .delete("/:plotId", async (c) => {
    await ctrl.remove(p(c, "storyId"), p(c, "chapterId"), p(c, "plotId"));
    return c.json({ ok: true });
  });

export { createListApp as plotCreateListRoutes, crudApp as plotCrudRoutes };

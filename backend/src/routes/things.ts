import { Hono } from "hono";
import { CreateThingBody, UpdateThingBody, EndEntityBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/things.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateThingBody.parse(await c.req.json());
    const thing = await ctrl.create(p(c, "worldId"), body);
    return c.json(thing, 201);
  })
  .get("/", async (c) => {
    const things = await ctrl.list(p(c, "worldId"));
    return c.json(things);
  })
  .get("/:thingId", async (c) => {
    const thing = await ctrl.getById(p(c, "worldId"), p(c, "thingId"));
    return c.json(thing);
  })
  .put("/:thingId", async (c) => {
    const body = UpdateThingBody.parse(await c.req.json());
    const thing = await ctrl.update(p(c, "worldId"), p(c, "thingId"), body);
    return c.json(thing);
  })
  .delete("/:thingId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "thingId"));
    return c.json({ ok: true });
  })
  .post("/:thingId/end", async (c) => {
    const body = EndEntityBody.parse(await c.req.json());
    const thing = await ctrl.end(p(c, "worldId"), p(c, "thingId"), body);
    return c.json(thing);
  })
  .delete("/:thingId/end", async (c) => {
    const thing = await ctrl.undoEnd(p(c, "worldId"), p(c, "thingId"));
    return c.json(thing);
  });

export default app;

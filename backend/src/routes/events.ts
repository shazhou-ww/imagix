import { CreateEventBody, UpdateEventBody } from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/events.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateEventBody.parse(await c.req.json());
    const evt = await ctrl.create(p(c, "worldId"), body);
    return c.json(evt, 201);
  })
  .get("/", async (c) => {
    const { timeFrom, timeTo } = c.req.query();
    const opts =
      timeFrom || timeTo
        ? {
            timeFrom: timeFrom ? Number(timeFrom) : undefined,
            timeTo: timeTo ? Number(timeTo) : undefined,
          }
        : undefined;
    const events = await ctrl.list(p(c, "worldId"), opts);
    return c.json(events);
  })
  .get("/:eventId", async (c) => {
    const evt = await ctrl.getById(p(c, "worldId"), p(c, "eventId"));
    return c.json(evt);
  })
  .put("/:eventId", async (c) => {
    const body = UpdateEventBody.parse(await c.req.json());
    const evt = await ctrl.update(p(c, "worldId"), p(c, "eventId"), body);
    return c.json(evt);
  })
  .delete("/:eventId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "eventId"));
    return c.json({ ok: true });
  });

export default app;

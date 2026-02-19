import { Hono } from "hono";
import { CreateEventLinkBody, DeleteEventLinkBody } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/event-links.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateEventLinkBody.parse(await c.req.json());
    const link = await ctrl.create(p(c, "worldId"), body);
    return c.json(link, 201);
  })
  .get("/", async (c) => {
    const links = await ctrl.list(p(c, "worldId"));
    return c.json(links);
  })
  .delete("/", async (c) => {
    const body = DeleteEventLinkBody.parse(await c.req.json());
    await ctrl.remove(p(c, "worldId"), body);
    return c.json({ ok: true });
  });

export default app;

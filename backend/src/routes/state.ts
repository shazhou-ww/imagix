import { EntityStateQuery } from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/state.js";

const app = new Hono<AppEnv>().use("*", auth).get("/", async (c) => {
  const { time, forEvent } = EntityStateQuery.parse({
    time: c.req.query("time"),
    forEvent: c.req.query("forEvent") || undefined,
  });
  const state = await ctrl.computeState(
    p(c, "worldId"),
    p(c, "entityId"),
    time,
    { forEvent },
  );
  return c.json(state);
});

export default app;

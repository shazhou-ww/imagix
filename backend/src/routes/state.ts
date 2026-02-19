import { Hono } from "hono";
import { EntityStateQuery } from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/state.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .get("/", async (c) => {
    const { time } = EntityStateQuery.parse({ time: c.req.query("time") });
    const state = await ctrl.computeState(p(c, "entityId"), time);
    return c.json(state);
  });

export default app;

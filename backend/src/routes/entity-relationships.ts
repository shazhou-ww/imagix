import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/relationships.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .get("/", async (c) => {
    const rels = await ctrl.listByEntity(p(c, "entityId"));
    return c.json(rels);
  });

export default app;

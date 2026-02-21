import { CreateRelationshipBody, EndEntityBody } from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/relationships.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateRelationshipBody.parse(await c.req.json());
    const rel = await ctrl.create(p(c, "worldId"), body);
    return c.json(rel, 201);
  })
  .get("/", async (c) => {
    const rels = await ctrl.list(p(c, "worldId"));
    return c.json(rels);
  })
  .get("/:relId", async (c) => {
    const rel = await ctrl.getById(p(c, "worldId"), p(c, "relId"));
    return c.json(rel);
  })
  .delete("/:relId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "relId"));
    return c.json({ ok: true });
  })
  .post("/:relId/end", async (c) => {
    const body = EndEntityBody.parse(await c.req.json());
    const rel = await ctrl.end(p(c, "worldId"), p(c, "relId"), body);
    return c.json(rel);
  })
  .delete("/:relId/end", async (c) => {
    const rel = await ctrl.undoEnd(p(c, "worldId"), p(c, "relId"));
    return c.json(rel);
  });

export default app;

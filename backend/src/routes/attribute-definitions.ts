import {
  CreateAttributeDefinitionBody,
  UpdateAttributeDefinitionBody,
} from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/attribute-definitions.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .get("/", async (c) => {
    const attrs = await ctrl.list(p(c, "worldId"));
    return c.json(attrs);
  })
  .post("/", async (c) => {
    const body = CreateAttributeDefinitionBody.parse(await c.req.json());
    const attr = await ctrl.create(p(c, "worldId"), body);
    return c.json(attr, 201);
  })
  .put("/:adfId", async (c) => {
    const body = UpdateAttributeDefinitionBody.parse(await c.req.json());
    const attr = await ctrl.update(p(c, "worldId"), p(c, "adfId"), body);
    return c.json(attr);
  })
  .delete("/:adfId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "adfId"));
    return c.json({ ok: true });
  });

export default app;

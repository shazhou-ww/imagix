import {
  CreateCharacterBody,
  EndEntityBody,
  UpdateCharacterBody,
} from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/characters.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreateCharacterBody.parse(await c.req.json());
    const char = await ctrl.create(p(c, "worldId"), body);
    return c.json(char, 201);
  })
  .get("/", async (c) => {
    const chars = await ctrl.list(p(c, "worldId"));
    return c.json(chars);
  })
  .get("/:charId", async (c) => {
    const char = await ctrl.getById(p(c, "worldId"), p(c, "charId"));
    return c.json(char);
  })
  .put("/:charId", async (c) => {
    const body = UpdateCharacterBody.parse(await c.req.json());
    const char = await ctrl.update(p(c, "worldId"), p(c, "charId"), body);
    return c.json(char);
  })
  .delete("/:charId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "charId"));
    return c.json({ ok: true });
  })
  .post("/:charId/end", async (c) => {
    const body = EndEntityBody.parse(await c.req.json());
    const char = await ctrl.end(p(c, "worldId"), p(c, "charId"), body);
    return c.json(char);
  })
  .delete("/:charId/end", async (c) => {
    const char = await ctrl.undoEnd(p(c, "worldId"), p(c, "charId"));
    return c.json(char);
  });

export default app;

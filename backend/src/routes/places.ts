import { CreatePlaceBody, UpdatePlaceBody } from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/places.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .post("/", async (c) => {
    const body = CreatePlaceBody.parse(await c.req.json());
    const place = await ctrl.create(p(c, "worldId"), body);
    return c.json(place, 201);
  })
  .get("/", async (c) => {
    const places = await ctrl.list(p(c, "worldId"));
    return c.json(places);
  })
  .get("/:placeId", async (c) => {
    const place = await ctrl.getById(p(c, "worldId"), p(c, "placeId"));
    return c.json(place);
  })
  .put("/:placeId", async (c) => {
    const body = UpdatePlaceBody.parse(await c.req.json());
    const place = await ctrl.update(p(c, "worldId"), p(c, "placeId"), body);
    return c.json(place);
  })
  .delete("/:placeId", async (c) => {
    await ctrl.remove(p(c, "worldId"), p(c, "placeId"));
    return c.json({ ok: true });
  });

export default app;

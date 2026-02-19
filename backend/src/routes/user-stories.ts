import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth } from "../app.js";
import * as ctrl from "../controllers/stories.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .get("/", async (c) => {
    const stories = await ctrl.listByUser(c.get("userId"));
    return c.json(stories);
  });

export default app;

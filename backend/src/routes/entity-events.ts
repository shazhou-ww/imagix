import type { Event } from "@imagix/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as repo from "../db/repository.js";

const app = new Hono<AppEnv>().use("*", auth).get("/", async (c) => {
  const worldId = p(c, "worldId");
  const entityId = p(c, "entityId");
  const { timeFrom, timeTo } = c.req.query();

  // Query entity→event index
  const opts: { timeLte?: number } = {};
  if (timeTo) opts.timeLte = Number(timeTo);

  const refs = await repo.listEventsByEntity(
    entityId,
    opts.timeLte != null ? opts : undefined,
  );

  // Fetch full events
  const events = await Promise.all(
    refs.map((ref) => {
      const r = ref as { worldId: string; eventId: string };
      return repo.getEventById(r.worldId || worldId, r.eventId);
    }),
  );

  let result = events.filter(
    (e): e is Record<string, unknown> => e != null,
  ) as unknown as Event[];

  // Apply timeFrom filter if specified
  if (timeFrom) {
    const from = Number(timeFrom);
    result = result.filter((e) => e.time >= from);
  }

  // Sort by time
  result.sort((a, b) => a.time - b.time);

  return c.json(result);
});

export default app;

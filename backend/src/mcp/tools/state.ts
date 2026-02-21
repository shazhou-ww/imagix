import { type ToolRegistry, jsonResult } from "../registry.js";
import * as stateCtrl from "../../controllers/state.js";

export function registerStateTools(registry: ToolRegistry) {
  registry.register({
    name: "compute_entity_state",
    description:
      "Compute an entity's dynamic state at a specific time by replaying events (event sourcing). " +
      "Returns accumulated attributes including system attrs ($age, $name, $alive) and user-defined ones. " +
      "Taxonomy timeFormulas are evaluated between events to derive time-dependent values (e.g. age).",
    inputSchema: {
      type: "object",
      properties: {
        worldId: { type: "string", description: "World ID" },
        entityId: { type: "string", description: "Entity ID (chr/thg/rel)" },
        time: { type: "number", description: "Point in time to compute state at (epoch ms)" },
        forEvent: { type: "string", description: "Exclude this event ID from computation (optional, for pre-event state)" },
      },
      required: ["worldId", "entityId", "time"],
    },
    handler: async (a) =>
      jsonResult(
        await stateCtrl.computeState(
          a.worldId as string,
          a.entityId as string,
          a.time as number,
          a.forEvent ? { forEvent: a.forEvent as string } : undefined,
        ),
      ),
  });
}

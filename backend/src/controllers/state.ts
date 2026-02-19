import type { Event, StateImpact } from "@imagix/shared";
import * as repo from "../db/repository.js";

export interface EntityState {
  entityId: string;
  time: number;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Compute entity state at a given time by replaying events (event sourcing).
 * Collects all events where this entity participates up to `time`,
 * then applies attribute changes in chronological order.
 */
export async function computeState(
  entityId: string,
  time: number,
): Promise<EntityState> {
  const eventRefs = await repo.listEventsByEntity(entityId, { timeLte: time });
  if (eventRefs.length === 0) {
    return { entityId, time, attributes: {} };
  }

  const attributes: Record<string, string | number | boolean> = {};

  for (const ref of eventRefs) {
    const evt = ref as unknown as Event;
    if (!evt.impacts) continue;
    const impacts: StateImpact = evt.impacts;

    for (const ac of impacts.attributeChanges) {
      if (ac.entityId === entityId) {
        attributes[ac.attribute] = ac.value;
      }
    }
  }

  return { entityId, time, attributes };
}

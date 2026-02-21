import type {
  StateImpact,
  TaxonomyNode,
  TaxonomyTree,
  Character,
  Thing,
  Relationship,
} from "@imagix/shared";
import jsonata from "jsonata";
import * as repo from "../db/repository.js";

export interface EntityState {
  entityId: string;
  time: number;
  attributes: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Helpers — entity type detection & taxonomy chain
// ---------------------------------------------------------------------------

/** Determine entity type from ID prefix. */
function entityType(entityId: string): "character" | "thing" | "relationship" {
  const prefix = entityId.slice(0, 3);
  if (prefix === "chr") return "character";
  if (prefix === "thg") return "thing";
  if (prefix === "rel") return "relationship";
  throw new Error(`Unknown entity prefix: ${prefix}`);
}

/** Map entity type → taxonomy tree enum. */
function treeForEntityType(
  type: "character" | "thing" | "relationship",
): TaxonomyTree {
  if (type === "character") return "CHAR";
  if (type === "thing") return "THING";
  return "REL";
}

/** Get entity's categoryNodeId / typeNodeId. */
async function getCategoryNodeId(
  worldId: string,
  entityId: string,
  type: "character" | "thing" | "relationship",
): Promise<string> {
  if (type === "character") {
    const c = (await repo.getCharacter(worldId, entityId)) as Character | null;
    if (!c) throw new Error(`Character ${entityId} not found`);
    return c.categoryNodeId;
  }
  if (type === "thing") {
    const t = (await repo.getThing(worldId, entityId)) as Thing | null;
    if (!t) throw new Error(`Thing ${entityId} not found`);
    return t.categoryNodeId;
  }
  // relationship
  const r = (await repo.getRelationship(
    worldId,
    entityId,
  )) as Relationship | null;
  if (!r) throw new Error(`Relationship ${entityId} not found`);
  return r.typeNodeId;
}

/**
 * Build an ordered list of JSONata timeFormula strings from the taxonomy
 * inheritance chain, root → leaf.
 *
 * Rules:
 *   - Walk from the entity's category node up to the root, collecting formulas.
 *   - Return them in root-to-leaf order.
 *   - Child nodes inherit the nearest ancestor's formula unless they define their own.
 *     (But we iterate from root to leaf so each formula is applied in sequence.)
 */
async function collectTimeFormulas(
  worldId: string,
  tree: TaxonomyTree,
  categoryNodeId: string,
): Promise<string[]> {
  // Fetch entire taxonomy tree for this world/tree-type
  const allNodes = (await repo.getTaxonomyTree(worldId, tree)) as TaxonomyNode[];
  const byId = new Map<string, TaxonomyNode>();
  for (const n of allNodes) byId.set(n.id, n);

  // Walk from leaf to root, collecting the chain
  const chain: TaxonomyNode[] = [];
  let current: TaxonomyNode | undefined = byId.get(categoryNodeId);
  while (current) {
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  // Reverse to get root → leaf order
  chain.reverse();

  // Collect formulas — each node may have its own timeFormula
  const formulas: string[] = [];
  for (const node of chain) {
    if (node.timeFormula) {
      formulas.push(node.timeFormula);
    }
  }

  return formulas;
}

/**
 * Evaluate all timeFormula expressions (root→leaf) and merge results into
 * the attributes map, mutating it in place.
 *
 * Each formula receives:
 *   { attributes, lastTime, currentTime }
 * and is expected to return a Record<string, any> of attribute patches.
 */
async function applyTimeFormulas(
  attributes: Record<string, string | number | boolean>,
  lastTime: number,
  currentTime: number,
  formulas: string[],
): Promise<void> {
  if (formulas.length === 0 || lastTime === currentTime) return;

  for (const formula of formulas) {
    try {
      const expr = jsonata(formula);
      const result = await expr.evaluate({ attributes, lastTime, currentTime });
      if (result && typeof result === "object" && !Array.isArray(result)) {
        for (const [k, v] of Object.entries(result)) {
          if (
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
          ) {
            attributes[k] = v;
          }
        }
      }
    } catch {
      // Skip invalid formulas silently — don't break state computation.
    }
  }
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute entity state at a given time by replaying events (event sourcing).
 *
 * Between consecutive events the taxonomy chain's JSONata timeFormula
 * expressions are evaluated (root→leaf) to derive time-dependent attributes
 * (e.g. age). After all events, the formulas are applied once more for the
 * remaining time gap up to the query `time`.
 */
export async function computeState(
  worldId: string,
  entityId: string,
  time: number,
  opts?: { forEvent?: string },
): Promise<EntityState> {
  const eventRefs = await repo.listEventsByEntity(entityId, { timeLte: time });
  if (eventRefs.length === 0) {
    return { entityId, time, attributes: {} };
  }

  // Event refs only contain { worldId, eventId } — fetch full events
  const fullEvents = await Promise.all(
    eventRefs.map((ref) => {
      const r = ref as { worldId: string; eventId: string; sk: string };
      return repo.getEventById(r.worldId, r.eventId);
    }),
  );

  const attributes: Record<string, string | number | boolean> = {};

  // Sort by time to replay in order, excluding the forEvent if specified
  const sorted = fullEvents
    .filter(
      (e): e is Record<string, unknown> =>
        e != null &&
        !!(e as Record<string, unknown>).impacts &&
        (e as Record<string, unknown>).id !== opts?.forEvent,
    )
    .sort((a, b) => (a.time as number) - (b.time as number));

  if (sorted.length === 0) {
    return { entityId, time, attributes: {} };
  }

  // --- Resolve taxonomy timeFormulas (root → leaf) ---
  const eType = entityType(entityId);
  const tree = treeForEntityType(eType);
  const categoryNodeId = await getCategoryNodeId(worldId, entityId, eType);
  const formulas = await collectTimeFormulas(worldId, tree, categoryNodeId);

  // --- Replay events ---
  let lastTime: number | null = null;

  for (const evt of sorted) {
    const currentTime = evt.time as number;
    const duration = (evt.duration as number) || 0;

    // Between events: apply JSONata time formulas.
    // Skip for the first event (birth / creation — no prior state to derive from).
    if (lastTime !== null) {
      await applyTimeFormulas(attributes, lastTime, currentTime, formulas);
    }

    // Apply attribute changes from this event
    const impacts = evt.impacts as StateImpact;
    for (const ac of impacts.attributeChanges) {
      if (ac.entityId === entityId) {
        attributes[ac.attribute] = ac.value;
      }
    }

    // System events (birth/creation/establishment) always fix $age to 0
    if (evt.system) {
      attributes["$age"] = 0;
    }

    // Apply time formulas for the event's duration (e.g. age increments during event)
    if (duration > 0) {
      await applyTimeFormulas(attributes, currentTime, currentTime + duration, formulas);
    }

    lastTime = currentTime + duration;
  }

  // --- After last event: apply time formulas up to the query time ---
  if (lastTime !== null && lastTime < time) {
    await applyTimeFormulas(attributes, lastTime, time, formulas);
  }

  return { entityId, time, attributes };
}

import type { TaxonomyTree } from "@imagix/shared";

const TIME_PAD = 16;

function padTime(time: number): string {
  return String(time).padStart(TIME_PAD, "0");
}

// ---------------------------------------------------------------------------
// Primary keys (pk / sk)
// ---------------------------------------------------------------------------

export const worldPk = (worldId: string) => `WORLD#${worldId}`;
export const worldSk = () => "#META";

export const taxonomySk = (tree: TaxonomyTree, nodeId: string) =>
  `TAXON#${tree}#${nodeId}`;

export const characterSk = (charId: string) => `CHAR#${charId}`;

export const thingSk = (thingId: string) => `THING#${thingId}`;

export const relationshipSk = (relId: string) => `REL#${relId}`;

export const eventSk = (time: number, eventId: string) =>
  `EVT#${padTime(time)}#${eventId}`;

export const eventLinkSk = (eidA: string, eidB: string) =>
  `EVTLINK#${eidA}#${eidB}`;

export const storySk = (storyId: string) => `STORY#${storyId}`;

export const storyPk = (storyId: string) => `STORY#${storyId}`;
export const chapterSk = (chapterId: string) => `CHAP#${chapterId}`;
export const plotSk = (plotId: string) => `PLOT#${plotId}`;

// ---------------------------------------------------------------------------
// Denormalized entity keys
// ---------------------------------------------------------------------------

export const entityPk = (entityId: string) => `ENTITY#${entityId}`;
export const relFromSk = (relId: string) => `REL_FROM#${relId}`;
export const relToSk = (relId: string) => `REL_TO#${relId}`;

// ---------------------------------------------------------------------------
// GSI1 keys
// ---------------------------------------------------------------------------

export const userGsi1pk = (userId: string) => `USER#${userId}`;

// ---------------------------------------------------------------------------
// Prefix constants for begins_with queries
// ---------------------------------------------------------------------------

export const PREFIX = {
  TAXON_CHAR: "TAXON#CHAR#",
  TAXON_THING: "TAXON#THING#",
  TAXON_REL: "TAXON#REL#",
  CHAR: "CHAR#",
  THING: "THING#",
  REL: "REL#",
  REL_FROM: "REL_FROM#",
  REL_TO: "REL_TO#",
  REL_ALL: "REL_",
  EVT: "EVT#",
  EVTLINK: "EVTLINK#",
  STORY: "STORY#",
  CHAP: "CHAP#",
  PLOT: "PLOT#",
  WORLD: "WORLD#",
} as const;

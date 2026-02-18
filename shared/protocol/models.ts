import { z } from "zod";
import { EntityPrefix, isValidId, isValidIdWithPrefix } from "./id.js";

// ---------------------------------------------------------------------------
// ID validators
// ---------------------------------------------------------------------------

const id = z.string().length(30).refine(isValidId, "Invalid ID format");

const wldId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.World));
const txnId = id.refine(
  (v) => isValidIdWithPrefix(v, EntityPrefix.TaxonomyNode),
);
const chrId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.Character));
const thgId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.Thing));
const relId = id.refine(
  (v) => isValidIdWithPrefix(v, EntityPrefix.Relationship),
);
const evtId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.Event));
const styId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.Story));
const chpId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.Chapter));
const pltId = id.refine((v) => isValidIdWithPrefix(v, EntityPrefix.Plot));

/** Any valid entity ID (prefix-agnostic). */
const entityId = id;

// ---------------------------------------------------------------------------
// Taxonomy tree types
// ---------------------------------------------------------------------------

export const TaxonomyTree = z.enum(["CHAR", "THING", "REL"]);
export type TaxonomyTree = z.infer<typeof TaxonomyTree>;

export const AttributeDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().optional(),
});

export const TaxonomyNodeSchema = z.object({
  id: txnId,
  worldId: wldId,
  tree: TaxonomyTree,
  name: z.string(),
  parentId: txnId.nullable(),
  attributeDefinitions: z.array(AttributeDefinitionSchema).default([]),
});

export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;
export type TaxonomyNode = z.infer<typeof TaxonomyNodeSchema>;

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export const WorldSchema = z.object({
  id: wldId,
  userId: z.string(),
  name: z.string(),
  description: z.string().default(""),
  settings: z.string().default(""),
  epoch: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type World = z.infer<typeof WorldSchema>;

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export const CharacterSchema = z.object({
  id: chrId,
  worldId: wldId,
  categoryNodeId: txnId,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Character = z.infer<typeof CharacterSchema>;

// ---------------------------------------------------------------------------
// Thing
// ---------------------------------------------------------------------------

export const ThingSchema = z.object({
  id: thgId,
  worldId: wldId,
  categoryNodeId: txnId,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Thing = z.infer<typeof ThingSchema>;

// ---------------------------------------------------------------------------
// Relationship (directed)
// ---------------------------------------------------------------------------

export const RelationshipSchema = z.object({
  id: relId,
  worldId: wldId,
  typeNodeId: txnId,
  fromId: entityId,
  toId: entityId,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// ---------------------------------------------------------------------------
// Event & StateImpact
// ---------------------------------------------------------------------------

export const AttributeChangeSchema = z.object({
  entityType: z.enum(["character", "thing"]),
  entityId: entityId,
  attribute: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const RelationshipChangeSchema = z.object({
  action: z.enum(["create", "remove"]),
  typeNodeId: txnId,
  fromId: entityId,
  toId: entityId,
});

export const RelationshipAttributeChangeSchema = z.object({
  relationshipId: relId,
  attribute: z.string(),
  direction: z.enum(["from_to", "to_from"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const StateImpactSchema = z.object({
  attributeChanges: z.array(AttributeChangeSchema).default([]),
  relationshipChanges: z.array(RelationshipChangeSchema).default([]),
  relationshipAttributeChanges: z
    .array(RelationshipAttributeChangeSchema)
    .default([]),
});

export const EventSchema = z.object({
  id: evtId,
  worldId: wldId,
  time: z.number(),
  placeId: thgId.nullable(),
  participantIds: z.array(entityId).default([]),
  content: z.string(),
  impacts: StateImpactSchema.default({
    attributeChanges: [],
    relationshipChanges: [],
    relationshipAttributeChanges: [],
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AttributeChange = z.infer<typeof AttributeChangeSchema>;
export type RelationshipChange = z.infer<typeof RelationshipChangeSchema>;
export type RelationshipAttributeChange = z.infer<
  typeof RelationshipAttributeChangeSchema
>;
export type StateImpact = z.infer<typeof StateImpactSchema>;
export type Event = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------
// EventLink
// ---------------------------------------------------------------------------

export const EventLinkSchema = z.object({
  worldId: wldId,
  eventIdA: evtId,
  eventIdB: evtId,
  description: z.string().default(""),
});

export type EventLink = z.infer<typeof EventLinkSchema>;

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export const StorySchema = z.object({
  id: styId,
  worldId: wldId,
  userId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Story = z.infer<typeof StorySchema>;

// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export const ChapterSchema = z.object({
  id: chpId,
  storyId: styId,
  seq: z.number().int().nonnegative(),
  title: z.string(),
  plotIds: z.array(pltId).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Chapter = z.infer<typeof ChapterSchema>;

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export const PlotSchema = z.object({
  id: pltId,
  storyId: styId,
  chapterSeq: z.number().int().nonnegative(),
  plotSeq: z.number().int().nonnegative(),
  eventIds: z.array(evtId).default([]),
  perspectiveCharacterId: chrId.nullable(),
  style: z.string().default(""),
  content: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Plot = z.infer<typeof PlotSchema>;

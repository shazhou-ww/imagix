import { z } from "zod";

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
  id: z.string(),
  worldId: z.string(),
  tree: TaxonomyTree,
  name: z.string(),
  parentId: z.string().nullable(),
  attributeDefinitions: z.array(AttributeDefinitionSchema).default([]),
});

export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;
export type TaxonomyNode = z.infer<typeof TaxonomyNodeSchema>;

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export const WorldSchema = z.object({
  id: z.string(),
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
  id: z.string(),
  worldId: z.string(),
  categoryNodeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Character = z.infer<typeof CharacterSchema>;

// ---------------------------------------------------------------------------
// Thing
// ---------------------------------------------------------------------------

export const ThingSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  categoryNodeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Thing = z.infer<typeof ThingSchema>;

// ---------------------------------------------------------------------------
// Relationship (directed)
// ---------------------------------------------------------------------------

export const RelationshipSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  typeNodeId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// ---------------------------------------------------------------------------
// Event & StateImpact
// ---------------------------------------------------------------------------

export const AttributeChangeSchema = z.object({
  entityType: z.enum(["character", "thing"]),
  entityId: z.string(),
  attribute: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const RelationshipChangeSchema = z.object({
  action: z.enum(["create", "remove"]),
  typeNodeId: z.string(),
  fromId: z.string(),
  toId: z.string(),
});

export const RelationshipAttributeChangeSchema = z.object({
  relationshipId: z.string(),
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
  id: z.string(),
  worldId: z.string(),
  time: z.number(),
  placeId: z.string().nullable(),
  participantIds: z.array(z.string()).default([]),
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
  worldId: z.string(),
  eventIdA: z.string(),
  eventIdB: z.string(),
  description: z.string().default(""),
});

export type EventLink = z.infer<typeof EventLinkSchema>;

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export const StorySchema = z.object({
  id: z.string(),
  worldId: z.string(),
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
  id: z.string(),
  storyId: z.string(),
  seq: z.number().int().nonnegative(),
  title: z.string(),
  plotIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Chapter = z.infer<typeof ChapterSchema>;

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export const PlotSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  chapterSeq: z.number().int().nonnegative(),
  plotSeq: z.number().int().nonnegative(),
  eventIds: z.array(z.string()).default([]),
  perspectiveCharacterId: z.string().nullable(),
  style: z.string().default(""),
  content: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Plot = z.infer<typeof PlotSchema>;

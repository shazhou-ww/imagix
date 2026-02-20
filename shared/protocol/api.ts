import { z } from "zod";
import {
  txnId,
  thgId,
  chrId,
  evtId,
  entityId,
  StateImpactSchema,
} from "./models.js";

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export const CreateWorldBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  settings: z.string().optional(),
  /** 纪元描述，如 "盘古开天辟地"。创建时必填，后端会自动创建 time=0 的纪元事件。 */
  epoch: z.string().min(1),
});
export const UpdateWorldBody = CreateWorldBody.partial();

export type CreateWorldBody = z.infer<typeof CreateWorldBody>;
export type UpdateWorldBody = z.infer<typeof UpdateWorldBody>;

// ---------------------------------------------------------------------------
// TaxonomyNode
// ---------------------------------------------------------------------------

export const CreateTaxonomyNodeBody = z.object({
  name: z.string().min(1),
  parentId: txnId.nullable().default(null),
  timeFormula: z.string().optional(),
});
export const UpdateTaxonomyNodeBody = CreateTaxonomyNodeBody.partial();

export type CreateTaxonomyNodeBody = z.infer<typeof CreateTaxonomyNodeBody>;
export type UpdateTaxonomyNodeBody = z.infer<typeof UpdateTaxonomyNodeBody>;

// ---------------------------------------------------------------------------
// AttributeDefinition（世界级属性术语字典）
// ---------------------------------------------------------------------------

export const CreateAttributeDefinitionBody = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "enum"]),
  enumValues: z.array(z.string()).min(1).optional(),
  description: z.string().optional(),
});
export const UpdateAttributeDefinitionBody = CreateAttributeDefinitionBody.partial();

export type CreateAttributeDefinitionBody = z.infer<typeof CreateAttributeDefinitionBody>;
export type UpdateAttributeDefinitionBody = z.infer<typeof UpdateAttributeDefinitionBody>;

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export const CreateCharacterBody = z.object({
  name: z.string().min(1),
  categoryNodeId: txnId,
  /** 出生时间（相对纪元的毫秒数）。后端会自动创建出生事件。 */
  birthTime: z.number(),
});
export const UpdateCharacterBody = CreateCharacterBody.partial();

export type CreateCharacterBody = z.infer<typeof CreateCharacterBody>;
export type UpdateCharacterBody = z.infer<typeof UpdateCharacterBody>;

// ---------------------------------------------------------------------------
// Thing
// ---------------------------------------------------------------------------

export const CreateThingBody = z.object({
  name: z.string().min(1),
  categoryNodeId: txnId,
});
export const UpdateThingBody = CreateThingBody.partial();

export type CreateThingBody = z.infer<typeof CreateThingBody>;
export type UpdateThingBody = z.infer<typeof UpdateThingBody>;

// ---------------------------------------------------------------------------
// Relationship
// ---------------------------------------------------------------------------

export const CreateRelationshipBody = z.object({
  typeNodeId: txnId,
  fromId: entityId,
  toId: entityId,
});

export type CreateRelationshipBody = z.infer<typeof CreateRelationshipBody>;

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export const CreateEventBody = z.object({
  time: z.number(),
  placeId: thgId.nullable().optional(),
  participantIds: z.array(entityId).optional(),
  content: z.string().min(1),
  impacts: StateImpactSchema.optional(),
});
export const UpdateEventBody = CreateEventBody.partial();

export type CreateEventBody = z.infer<typeof CreateEventBody>;
export type UpdateEventBody = z.infer<typeof UpdateEventBody>;

// ---------------------------------------------------------------------------
// EventLink
// ---------------------------------------------------------------------------

export const CreateEventLinkBody = z.object({
  eventIdA: evtId,
  eventIdB: evtId,
  description: z.string().optional(),
});
export const DeleteEventLinkBody = z.object({
  eventIdA: evtId,
  eventIdB: evtId,
});

export type CreateEventLinkBody = z.infer<typeof CreateEventLinkBody>;
export type DeleteEventLinkBody = z.infer<typeof DeleteEventLinkBody>;

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export const CreateStoryBody = z.object({
  title: z.string().min(1),
});
export const UpdateStoryBody = z.object({
  title: z.string().min(1).optional(),
  chapterIds: z.array(z.string()).optional(),
});

export type CreateStoryBody = z.infer<typeof CreateStoryBody>;
export type UpdateStoryBody = z.infer<typeof UpdateStoryBody>;

// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export const CreateChapterBody = z.object({
  title: z.string().min(1),
});
export const UpdateChapterBody = z.object({
  title: z.string().min(1).optional(),
  plotIds: z.array(z.string()).optional(),
});

export type CreateChapterBody = z.infer<typeof CreateChapterBody>;
export type UpdateChapterBody = z.infer<typeof UpdateChapterBody>;

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export const CreatePlotBody = z.object({
  eventId: evtId,
  perspectiveCharacterId: chrId.nullable().optional(),
  style: z.string().optional(),
  content: z.string().optional(),
});
export const UpdatePlotBody = z.object({
  perspectiveCharacterId: chrId.nullable().optional(),
  style: z.string().optional(),
  content: z.string().optional(),
});

export type CreatePlotBody = z.infer<typeof CreatePlotBody>;
export type UpdatePlotBody = z.infer<typeof UpdatePlotBody>;

// ---------------------------------------------------------------------------
// Entity State query
// ---------------------------------------------------------------------------

export const EntityStateQuery = z.object({
  time: z.coerce.number(),
});

export type EntityStateQuery = z.infer<typeof EntityStateQuery>;

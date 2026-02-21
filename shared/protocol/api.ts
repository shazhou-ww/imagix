import { z } from "zod";
import {
  chrId,
  entityId,
  evtId,
  plcId,
  StateImpactSchema,
  txnId,
} from "./models.js";

// ---------------------------------------------------------------------------
// EndEntity——实体消亡（角色/事物/关系通用）
// ---------------------------------------------------------------------------

export const EndEntityBody = z.object({
  /** 消亡时间（相对纪元的毫秒数）。 */
  time: z.number(),
  /** 消亡事件内容（可选，默认自动生成）。 */
  content: z.string().optional(),
  /** 导致消亡的因果事件 ID（可选，若提供则自动创建事件关联）。 */
  causeEventId: evtId.optional(),
});

export type EndEntityBody = z.infer<typeof EndEntityBody>;

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
// Place
// ---------------------------------------------------------------------------

export const CreatePlaceBody = z.object({
  name: z.string().min(1),
  parentId: plcId.nullable().default(null),
  description: z.string().optional(),
});
export const UpdatePlaceBody = CreatePlaceBody.partial();

export type CreatePlaceBody = z.infer<typeof CreatePlaceBody>;
export type UpdatePlaceBody = z.infer<typeof UpdatePlaceBody>;

// ---------------------------------------------------------------------------
// AttributeDefinition（世界级属性术语字典）
// ---------------------------------------------------------------------------

export const CreateAttributeDefinitionBody = z.object({
  name: z.string().min(1),
  type: z.enum([
    "string",
    "number",
    "boolean",
    "enum",
    "timestamp",
    "timespan",
  ]),
  enumValues: z.array(z.string()).min(1).optional(),
  description: z.string().optional(),
});
export const UpdateAttributeDefinitionBody =
  CreateAttributeDefinitionBody.partial();

export type CreateAttributeDefinitionBody = z.infer<
  typeof CreateAttributeDefinitionBody
>;
export type UpdateAttributeDefinitionBody = z.infer<
  typeof UpdateAttributeDefinitionBody
>;

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export const CreateCharacterBody = z.object({
  name: z.string().min(1),
  categoryNodeId: txnId,
  /** 诞生时间（相对纪元的毫秒数）。后端会自动创建「诞生」事件。 */
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
  /** 创建时间（相对纪元的毫秒数）。后端会自动创建「创建」事件。 */
  creationTime: z.number(),
});
export const UpdateThingBody = CreateThingBody.partial();

export type CreateThingBody = z.infer<typeof CreateThingBody>;
export type UpdateThingBody = z.infer<typeof UpdateThingBody>;

// ---------------------------------------------------------------------------
// Relationship
// ---------------------------------------------------------------------------

export const CreateRelationshipBody = z
  .object({
    typeNodeId: txnId,
    fromId: entityId,
    toId: entityId,
    /** 建立时间（相对纪元的毫秒数）。后端会自动创建「建立」事件。 */
    establishTime: z.number(),
  })
  .refine((data) => data.fromId !== data.toId, {
    message: "关系的源实体和目标实体不能相同",
    path: ["toId"],
  });

export type CreateRelationshipBody = z.infer<typeof CreateRelationshipBody>;

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export const CreateEventBody = z.object({
  time: z.number(),
  duration: z.number().optional(),
  placeId: plcId.nullable().optional(),
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
  /** 标明此次计算是为某个事件，该事件自身的影响会被排除。用于编辑事件时计算「事件发生前」的状态。 */
  forEvent: z.string().optional(),
});

export type EntityStateQuery = z.infer<typeof EntityStateQuery>;

// ---------------------------------------------------------------------------
// WorldTemplate
// ---------------------------------------------------------------------------

export const CreateTemplateBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export const UpdateTemplateBody = CreateTemplateBody.partial();

export type CreateTemplateBody = z.infer<typeof CreateTemplateBody>;
export type UpdateTemplateBody = z.infer<typeof UpdateTemplateBody>;

/** 从模板创建世界时的请求体。可覆盖模板中的世界名称和纪元描述。 */
export const CreateWorldFromTemplateBody = z.object({
  /** 新世界名称。不提供则使用模板中的名称。 */
  name: z.string().min(1).optional(),
  /** 新世界描述。不提供则使用模板中的描述。 */
  description: z.string().optional(),
  /** 纪元描述覆盖。不提供则使用模板中的纪元。 */
  epoch: z.string().min(1).optional(),
});

export type CreateWorldFromTemplateBody = z.infer<
  typeof CreateWorldFromTemplateBody
>;

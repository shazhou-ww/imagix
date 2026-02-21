import { z } from "zod";
import { EntityPrefix, isValidId, isValidIdWithPrefix } from "./id.js";

// ---------------------------------------------------------------------------
// ID validators — 各实体的带前缀 ID 校验器
// ---------------------------------------------------------------------------

/** 通用 ID：30 位字符串，格式由 isValidId 校验。 */
export const id = z.string().length(30).refine(isValidId, "Invalid ID format");

/** 世界 ID */
export const wldId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.World),
);
/** 分类节点 ID */
export const txnId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.TaxonomyNode),
);
/** 属性定义 ID */
export const adfId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.AttributeDefinition),
);
/** 角色 ID */
export const chrId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Character),
);
/** 事物 ID */
export const thgId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Thing),
);
/** 地点 ID */
export const plcId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Place),
);
/** 关系 ID */
export const relId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Relationship),
);
/** 事件 ID */
export const evtId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Event),
);
/** 故事 ID */
export const styId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Story),
);
/** 章节 ID */
export const chpId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Chapter),
);
/** 情节 ID */
export const pltId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Plot),
);
/** 模板 ID */
export const tplId = id.refine((v) =>
  isValidIdWithPrefix(v, EntityPrefix.Template),
);

/** 任意实体 ID（不限定前缀），用于 from/to 等可指向多种实体的引用字段。 */
export const entityId = id;

// ---------------------------------------------------------------------------
// Taxonomy tree types — 分类体系
// ---------------------------------------------------------------------------

/**
 * 分类树类型枚举。
 * 每个世界包含三棵独立的分类树：
 * - CHAR: 角色分类树（定义角色的分类层级与属性 Schema）
 * - THING: 事物分类树（定义事物的分类层级与属性 Schema）
 * - REL: 关系类型树（定义关系的类型层级与属性 Schema）
 */
export const TaxonomyTree = z.enum(["CHAR", "THING", "REL"]);
export type TaxonomyTree = z.infer<typeof TaxonomyTree>;

/**
 * 属性定义 Schema。
 * 世界级别的独立实体，作为属性术语的统一字典。
 * 所有角色、事物、关系的属性值以此为准，确保术语一致。
 */
export const AttributeDefinitionSchema = z.object({
  /** 属性定义唯一标识。 */
  id: adfId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 属性名称，如 "修为境界"、"灵根"。 */
  name: z.string(),
  /** 属性值类型。enum 表示字符串枚举，需配合 enumValues 使用；timestamp 使用世界纪元毫秒数；timespan 表示时间跨度（毫秒）。 */
  type: z.enum([
    "string",
    "number",
    "boolean",
    "enum",
    "timestamp",
    "timespan",
  ]),
  /** 当 type 为 "enum" 时，可选值列表（至少 1 项）。其他类型时忽略。 */
  enumValues: z.array(z.string()).min(1).optional(),
  /** 属性的可选说明。 */
  description: z.string().optional(),
  /** 系统预置属性，不可编辑或删除。 */
  system: z.boolean().default(false),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

/**
 * 分类节点 Schema。
 * 分类体系以树形结构组织，提供角色、事物、关系的分类层级。
 * 例如：生物 → 人类 → 修仙者。
 */
export const TaxonomyNodeSchema = z.object({
  /** 分类节点唯一标识。 */
  id: txnId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 所属分类树类型（角色分类 / 事物分类 / 关系类型）。 */
  tree: TaxonomyTree,
  /** 分类名称，如 "修仙者"、"道具"、"血缘关系"。 */
  name: z.string(),
  /** 分类描述。 */
  description: z.string().default(""),
  /** 父节点 ID，null 表示根节点。 */
  parentId: txnId.nullable(),
  /**
   * 可选的 JSONata 时间派生公式（子节点继承，可覆盖）。
   * 在事件溯源回放时，每个事件应用前先执行此公式，推算时间流逝导致的属性变化。
   * 输入上下文: { attributes: Record<string, any>, lastTime: number, currentTime: number }
   * 输出: Record<string, any>（需要变更的属性名→新值映射）
   * 示例: `{ "$age": attributes.$age + (currentTime - lastTime) }`
   */
  timeFormula: z.string().optional(),
  /** 系统预置节点，不可编辑或删除。 */
  system: z.boolean().default(false),
});

export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;
export type TaxonomyNode = z.infer<typeof TaxonomyNodeSchema>;

// ---------------------------------------------------------------------------
// World — 世界
// ---------------------------------------------------------------------------

/**
 * 世界 Schema。
 * 故事世界是所有概念的顶层容器，包含分类体系、角色、事物、事件等。
 */
export const WorldSchema = z.object({
  /** 世界唯一标识。 */
  id: wldId,
  /** 创建者的用户 ID。 */
  userId: z.string(),
  /** 世界名称。 */
  name: z.string(),
  /** 世界描述。 */
  description: z.string().default(""),
  /** 世界设定：物理法则、力量体系、社会规则等。 */
  settings: z.string().default(""),
  /**
   * 时间纪元描述：对 t=0 原点的文字说明，如 "盘古开天辟地"、"基督诞生"。
   * 世界中应存在一个 time=0 的事件作为纪元原点，所有时间以毫秒为单位相对于此原点计算。
   */
  epoch: z.string().default(""),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type World = z.infer<typeof WorldSchema>;

// ---------------------------------------------------------------------------
// Character — 角色
// ---------------------------------------------------------------------------

/**
 * 角色 Schema。
 * 世界中有主观能动性的行为体（人、动物、妖怪、神仙等）。
 * 仅存储静态不变的参数；可变属性值由事件溯源推算。
 */
export const CharacterSchema = z.object({
  /** 角色唯一标识。 */
  id: chrId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 角色名称，如 "张三丰"、"林黛玉"。 */
  name: z.string(),
  /** 角色描述。 */
  description: z.string().default(""),
  /** 角色分类节点引用，从角色分类树 (CHAR) 中选取。 */
  categoryNodeId: txnId,
  /** 消亡事件 ID。若存在，表示该角色已消亡。 */
  endEventId: evtId.optional(),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
  /** 软删除时间戳。 */
  deletedAt: z.string().optional(),
});

export type Character = z.infer<typeof CharacterSchema>;

// ---------------------------------------------------------------------------
// Thing — 事物
// ---------------------------------------------------------------------------

/**
 * 事物 Schema。
 * 世界中无主观能动性的实体（道具、场所、地点、势力等）。
 * 仅存储静态不变的参数；可变属性值由事件溯源推算。
 */
export const ThingSchema = z.object({
  /** 事物唯一标识。 */
  id: thgId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 事物名称，如 "轩辕剑"、"洛阳城"。 */
  name: z.string(),
  /** 事物描述。 */
  description: z.string().default(""),
  /** 事物分类节点引用，从事物分类树 (THING) 中选取。 */
  categoryNodeId: txnId,
  /** 消亡事件 ID。若存在，表示该事物已消亡。 */
  endEventId: evtId.optional(),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
  /** 软删除时间戳。 */
  deletedAt: z.string().optional(),
});

export type Thing = z.infer<typeof ThingSchema>;

// ---------------------------------------------------------------------------
// Relationship — 关系（有向二元关系）
// ---------------------------------------------------------------------------

/**
 * 关系 Schema。
 * 实体之间的有向二元关系，每个关系用一个词精确表达。
 * 支持三种类型：角色→角色、角色→事物、事物→事物。
 * 关系属性按 from→to 和 to→from 两个方向分别持有值。
 */
export const RelationshipSchema = z.object({
  /** 关系唯一标识。 */
  id: relId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 关系类型节点引用，从关系类型树 (REL) 中选取。 */
  typeNodeId: txnId,
  /** 源实体 ID（关系的起点）。 */
  fromId: entityId,
  /** 目标实体 ID（关系的终点）。 */
  toId: entityId,
  /** 消亡事件 ID。若存在，表示该关系已解除。 */
  endEventId: evtId.optional(),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
  /** 软删除时间戳。 */
  deletedAt: z.string().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// ---------------------------------------------------------------------------
// Place — 地点（空间层级结构）
// ---------------------------------------------------------------------------

/**
 * 地点 Schema。
 * 故事世界中的空间容器，具有层级包含关系（国 → 城 → 街 → 建筑 → 房间）。
 * 地点是永恒的空间概念，不参与生命周期机制（无 $alive、$age、endEventId）。
 */
export const PlaceSchema = z.object({
  /** 地点唯一标识。 */
  id: plcId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 地点名称，如 "临安城"、"知味楼"。 */
  name: z.string(),
  /** 父地点 ID，null 表示顶层地点。 */
  parentId: plcId.nullable(),
  /** 地点描述。 */
  description: z.string().default(""),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type Place = z.infer<typeof PlaceSchema>;

// ---------------------------------------------------------------------------
// Event & StateImpact — 事件与状态影响
// ---------------------------------------------------------------------------

/**
 * 属性变更 Schema。
 * 描述一个事件对某个角色或事物的某个属性值的变更。
 */
export const AttributeChangeSchema = z.object({
  /** 目标实体 ID。 */
  entityId: entityId,
  /** 要变更的属性名称（需与分类节点定义的属性 Schema 匹配）。 */
  attribute: z.string(),
  /** 变更后的属性值。 */
  value: z.union([z.string(), z.number(), z.boolean()]),
});

/**
 * 关系属性变更 Schema。
 * 描述一个事件对某条关系的某个属性值的变更。
 * 关系属性按方向区分：from→to 方向和 to→from 方向各自独立持有属性值。
 * 例如"父子"关系：from→to 称谓="儿子"，to→from 称谓="父亲"。
 */
export const RelationshipAttributeChangeSchema = z.object({
  /** 目标关系 ID。 */
  relationshipId: relId,
  /** 要变更的属性名称。 */
  attribute: z.string(),
  /** 属性值的方向：from_to（源→目标方向）或 to_from（目标→源方向）。 */
  direction: z.enum(["from_to", "to_from"]),
  /** 变更后的属性值。 */
  value: z.union([z.string(), z.number(), z.boolean()]),
});

/**
 * 状态影响声明 Schema。
 * 汇总一个事件导致的所有状态变更，包括属性变更和关系属性变更。
 * 事件是所有可变状态的唯一变更源（Single Source of Truth）。
 * 实体的创生/消亡通过实体自身的生命周期 API 管理，不再由事件 impact 直接操作。
 */
export const StateImpactSchema = z.object({
  /** 实体属性值变更列表。 */
  attributeChanges: z.array(AttributeChangeSchema).default([]),
  /** 关系属性值变更列表。 */
  relationshipAttributeChanges: z
    .array(RelationshipAttributeChangeSchema)
    .default([]),
});

/**
 * 事件 Schema。
 * 在某个时间、某个地点，某些角色/事物发生的一件事。
 * 事件是所有可变状态的唯一变更源——通过事件溯源推算任意时间点的实体状态。
 */
export const EventSchema = z.object({
  /** 事件唯一标识。 */
  id: evtId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /**
   * 世界纪元时间点，以毫秒为单位，相对于世界纪元原点 (t=0) 的偏移量。
   * t=0 对应 World.epoch 描述的纪元原点事件。
   */
  time: z.number(),
  /**
   * 事件持续时间，以毫秒为单位，默认 0 表示瞬时事件。
   * 事件占据 [time, time+duration] 的时间区间。
   * 时间派生公式（如年龄增长）会在事件持续期间内自动计算。
   */
  duration: z.number().default(0),
  /** 事件发生地点，引用某个地点；null 表示无明确地点。 */
  placeId: plcId.nullable(),
  /** 事件内容：提纲挈领的关键梗概，不做详细文学展开。 */
  content: z.string(),
  /** 状态影响声明：该事件导致的属性值变化。 */
  impacts: StateImpactSchema.default({
    attributeChanges: [],
    relationshipAttributeChanges: [],
  }),
  /** 系统预置事件，不可编辑或删除。 */
  system: z.boolean().default(false),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type AttributeChange = z.infer<typeof AttributeChangeSchema>;
export type RelationshipAttributeChange = z.infer<
  typeof RelationshipAttributeChangeSchema
>;
export type StateImpact = z.infer<typeof StateImpactSchema>;
export type Event = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------
// EventLink — 事件关联
// ---------------------------------------------------------------------------

/**
 * 事件关联 Schema。
 * 标记两个事件之间的相关性，用于 AI 检索时沿关联链还原上下文。
 * 关联是无向的（A-B 等同于 B-A）。
 */
export const EventLinkSchema = z.object({
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 关联的第一个事件 ID。 */
  eventIdA: evtId,
  /** 关联的第二个事件 ID。 */
  eventIdB: evtId,
  /** 关联说明：可选的简短描述。 */
  description: z.string().default(""),
});

export type EventLink = z.infer<typeof EventLinkSchema>;

// ---------------------------------------------------------------------------
// Story — 故事
// ---------------------------------------------------------------------------

/**
 * 故事 Schema。
 * 一系列情节的有序集合，包含多个章节。
 */
export const StorySchema = z.object({
  /** 故事唯一标识。 */
  id: styId,
  /** 所属世界 ID。 */
  worldId: wldId,
  /** 创建者的用户 ID。 */
  userId: z.string(),
  /** 故事标题。 */
  title: z.string(),
  /** 有序的章节 ID 列表，决定章节在故事中的排列顺序。 */
  chapterIds: z.array(chpId).default([]),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type Story = z.infer<typeof StorySchema>;

// ---------------------------------------------------------------------------
// Chapter — 章节
// ---------------------------------------------------------------------------

/**
 * 章节 Schema。
 * 故事的结构化分段，包含有序的情节列表。章节在故事中的顺序由 Story.chapterIds 决定。
 */
export const ChapterSchema = z.object({
  /** 章节唯一标识。 */
  id: chpId,
  /** 所属故事 ID。 */
  storyId: styId,
  /** 章节标题。 */
  title: z.string(),
  /** 有序的情节 ID 列表，决定情节在章节中的排列顺序。 */
  plotIds: z.array(pltId).default([]),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type Chapter = z.infer<typeof ChapterSchema>;

// ---------------------------------------------------------------------------
// Plot — 情节
// ---------------------------------------------------------------------------

/**
 * 情节 Schema。
 * 对单个事件的文学化展开。一个事件可生成多个不同版本的情节（一对多）。
 * 情节不能超越事件本身设定的框架。
 */
export const PlotSchema = z.object({
  /** 情节唯一标识。 */
  id: pltId,
  /** 所属故事 ID。 */
  storyId: styId,
  /** 所属章节 ID。 */
  chapterId: chpId,
  /** 关联的事件 ID，情节展开此事件的文学化描述。一个事件可对应多个情节版本。 */
  eventId: evtId,
  /** 视角角色 ID：从哪个角色的视角叙述；null 表示无特定视角（如上帝视角）。 */
  perspectiveCharacterId: chrId.nullable(),
  /** 文风：文学风格描述。 */
  style: z.string().default(""),
  /** 文学化文本内容。 */
  content: z.string().default(""),
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type Plot = z.infer<typeof PlotSchema>;

// ---------------------------------------------------------------------------
// WorldTemplate — 世界模板
// ---------------------------------------------------------------------------

/**
 * 世界模板快照 Schema。
 * 保存世界结构数据的快照：世界设定、分类体系、属性定义、地点。
 * 不包含角色、事物、关系、事件、故事等运行时数据。
 */
export const TemplateSnapshotSchema = z.object({
  /** 世界基础设定。 */
  world: z.object({
    name: z.string(),
    description: z.string().default(""),
    settings: z.string().default(""),
    epoch: z.string().default(""),
  }),
  /** 分类节点列表（CHAR / THING / REL 三棵树的全部节点）。 */
  taxonomy: z.array(z.record(z.unknown())).default([]),
  /** 属性定义列表。 */
  attributeDefinitions: z.array(z.record(z.unknown())).default([]),
  /** 地点列表。 */
  places: z.array(z.record(z.unknown())).default([]),
});

/**
 * 世界模板 Schema。
 * 用户可以将某个世界保存为模板，也可以基于模板快速创建新世界。
 */
export const WorldTemplateSchema = z.object({
  /** 模板唯一标识。 */
  id: tplId,
  /** 创建者的用户 ID。 */
  userId: z.string(),
  /** 模板名称。 */
  name: z.string(),
  /** 模板描述。 */
  description: z.string().default(""),
  /** 来源世界 ID（若从某个世界保存而来）。 */
  sourceWorldId: wldId.optional(),
  /** 世界结构快照。 */
  snapshot: TemplateSnapshotSchema,
  /** 创建时间。 */
  createdAt: z.string(),
  /** 最后更新时间。 */
  updatedAt: z.string(),
});

export type TemplateSnapshot = z.infer<typeof TemplateSnapshotSchema>;
export type WorldTemplate = z.infer<typeof WorldTemplateSchema>;

import {
  createId,
  EntityPrefix,
  WorldSchema,
  EventSchema,
  TaxonomyNodeSchema,
  AttributeDefinitionSchema,
  CharacterSchema,
  ThingSchema,
  RelationshipSchema,
  EventLinkSchema,
  type World,
  type CreateWorldBody,
  type UpdateWorldBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

/** 所有根分类节点预置的 JSONata 时间公式：随时间流逝自动递增 $age（存续时间） */
const AGE_TIME_FORMULA = '{ "$age": attributes.`$age` + (currentTime - lastTime) }';

export async function create(userId: string, body: CreateWorldBody): Promise<World> {
  const now = new Date().toISOString();
  const world = WorldSchema.parse({
    id: createId(EntityPrefix.World),
    userId,
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putWorld(world);

  // 自动创建 time=0 的纪元事件
  const epochEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId: world.id,
    time: 0,
    placeId: null,
    participantIds: [],
    content: body.epoch,
    impacts: {
      attributeChanges: [],
      relationshipChanges: [],
      relationshipAttributeChanges: [],
    },
    system: true,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putEvent(epochEvent);

  // 预置角色根分类节点（含年龄自动计算公式）
  const charRoot = TaxonomyNodeSchema.parse({
    id: createId(EntityPrefix.TaxonomyNode),
    worldId: world.id,
    tree: "CHAR",
    name: "角色",
    parentId: null,
    timeFormula: AGE_TIME_FORMULA,
    system: true,
  });
  await repo.putTaxonomyNode(charRoot);

  // 预置事物根分类节点（含 $age 自动计算公式）
  const thingRoot = TaxonomyNodeSchema.parse({
    id: createId(EntityPrefix.TaxonomyNode),
    worldId: world.id,
    tree: "THING",
    name: "事物",
    parentId: null,
    timeFormula: AGE_TIME_FORMULA,
    system: true,
  });
  await repo.putTaxonomyNode(thingRoot);

  // 预置关系根分类节点（含 $age 自动计算公式）
  const relRoot = TaxonomyNodeSchema.parse({
    id: createId(EntityPrefix.TaxonomyNode),
    worldId: world.id,
    tree: "REL",
    name: "关系",
    parentId: null,
    timeFormula: AGE_TIME_FORMULA,
    system: true,
  });
  await repo.putTaxonomyNode(relRoot);

  // 预置「$age」属性定义（time 类型，不可删除/编辑）
  const ageAttr = AttributeDefinitionSchema.parse({
    id: createId(EntityPrefix.AttributeDefinition),
    worldId: world.id,
    name: "$age",
    type: "time",
    description: "存续时间。角色诞生 / 事物创建 / 关系建立时自动设为 0，随时间流逝自动递增。",
    system: true,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putAttributeDefinition(ageAttr);

  return world;
}

export async function list(userId: string): Promise<World[]> {
  const items = await repo.listWorldsByUser(userId);
  return items as World[];
}

export async function getById(worldId: string): Promise<World> {
  const item = await repo.getWorld(worldId);
  if (!item) throw AppError.notFound("World");
  return item as World;
}

export async function update(
  worldId: string,
  body: UpdateWorldBody,
): Promise<World> {
  await repo.getWorld(worldId).then((w) => {
    if (!w) throw AppError.notFound("World");
  });
  await repo.updateWorld(worldId, { ...body, updatedAt: new Date().toISOString() });
  return (await repo.getWorld(worldId)) as World;
}

export async function remove(worldId: string): Promise<void> {
  await repo.deleteWorld(worldId);
}

// ---------------------------------------------------------------------------
// Export — 导出世界全部数据
// ---------------------------------------------------------------------------

export async function exportWorld(worldId: string) {
  const world = await repo.getWorld(worldId);
  if (!world) throw AppError.notFound("World");

  const [
    charTree,
    thingTree,
    relTree,
    attributeDefinitions,
    characters,
    things,
    relationships,
    events,
    eventLinks,
    stories,
  ] = await Promise.all([
    repo.getTaxonomyTree(worldId, "CHAR"),
    repo.getTaxonomyTree(worldId, "THING"),
    repo.getTaxonomyTree(worldId, "REL"),
    repo.listAttributeDefinitions(worldId),
    repo.listCharacters(worldId),
    repo.listThings(worldId),
    repo.listRelationships(worldId),
    repo.listEvents(worldId),
    repo.listEventLinks(worldId),
    repo.listStoriesByWorld(worldId),
  ]);

  const taxonomy = [...charTree, ...thingTree, ...relTree];

  // Strip DynamoDB key fields (pk, sk, gsi1pk, gsi1sk)
  const strip = (items: Record<string, unknown>[]) =>
    items.map(({ pk, sk, gsi1pk, gsi1sk, ...rest }) => rest);

  return {
    world: (() => {
      const { pk, sk, gsi1pk, gsi1sk, ...rest } = world as Record<string, unknown>;
      return rest;
    })(),
    taxonomy: strip(taxonomy as Record<string, unknown>[]),
    attributeDefinitions: strip(attributeDefinitions as Record<string, unknown>[]),
    characters: strip(characters as Record<string, unknown>[]),
    things: strip(things as Record<string, unknown>[]),
    relationships: strip(relationships as Record<string, unknown>[]),
    events: strip(events as Record<string, unknown>[]),
    eventLinks: strip(eventLinks as Record<string, unknown>[]),
    stories: strip(stories as Record<string, unknown>[]),
  };
}

// ---------------------------------------------------------------------------
// Import — 导入世界数据（相同 ID 覆盖）
// ---------------------------------------------------------------------------

export async function importWorld(
  worldId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const existing = await repo.getWorld(worldId);
  if (!existing) throw AppError.notFound("World");

  // Taxonomy nodes
  const taxonomy = (data.taxonomy ?? []) as Record<string, unknown>[];
  for (const raw of taxonomy) {
    const node = TaxonomyNodeSchema.parse({ ...raw, worldId });
    await repo.putTaxonomyNode(node);
  }

  // Attribute definitions
  const attrDefs = (data.attributeDefinitions ?? []) as Record<string, unknown>[];
  for (const raw of attrDefs) {
    const attr = AttributeDefinitionSchema.parse({ ...raw, worldId });
    await repo.putAttributeDefinition(attr);
  }

  // Characters
  const characters = (data.characters ?? []) as Record<string, unknown>[];
  for (const raw of characters) {
    const char = CharacterSchema.parse({ ...raw, worldId });
    await repo.putCharacter(char);
  }

  // Things
  const things = (data.things ?? []) as Record<string, unknown>[];
  for (const raw of things) {
    const thing = ThingSchema.parse({ ...raw, worldId });
    await repo.putThing(thing);
  }

  // Relationships
  const relationships = (data.relationships ?? []) as Record<string, unknown>[];
  for (const raw of relationships) {
    const rel = RelationshipSchema.parse({ ...raw, worldId });
    await repo.putRelationship(rel);
  }

  // Events
  const events = (data.events ?? []) as Record<string, unknown>[];
  for (const raw of events) {
    const evt = EventSchema.parse({ ...raw, worldId });
    await repo.putEvent(evt);
  }

  // Event links
  const eventLinks = (data.eventLinks ?? []) as Record<string, unknown>[];
  for (const raw of eventLinks) {
    const link = EventLinkSchema.parse({ ...raw, worldId });
    await repo.putEventLink(link);
  }
}

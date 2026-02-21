import {
  createId,
  EntityPrefix,
  RelationshipSchema,
  EventSchema,
  type Relationship,
  type CreateRelationshipBody,
  type TaxonomyNode,
  type Character,
  type Thing,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  body: CreateRelationshipBody,
): Promise<Relationship> {
  const now = new Date().toISOString();
  const rel = RelationshipSchema.parse({
    id: createId(EntityPrefix.Relationship),
    worldId,
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putRelationship(rel);

  // 查询关系类型名称和 from/to 实体名称以构建 $name
  const typeNode = await repo.getTaxonomyNode(worldId, "REL", body.typeNodeId) as TaxonomyNode | null;
  const typeName = typeNode?.name ?? "未知类型";
  // from/to 可能是角色或事物
  const fromChar = await repo.getCharacter(worldId, body.fromId) as Character | null;
  const fromThing = fromChar ? null : await repo.getThing(worldId, body.fromId) as Thing | null;
  const fromName = fromChar?.name ?? fromThing?.name ?? body.fromId;
  const toChar = await repo.getCharacter(worldId, body.toId) as Character | null;
  const toThing = toChar ? null : await repo.getThing(worldId, body.toId) as Thing | null;
  const toName = toChar?.name ?? toThing?.name ?? body.toId;
  const relName = `${typeName}·${fromName}·${toName}`;

  // 自动创建「建立」事件（含 $age=0 和 $name 的属性变更）
  const establishEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.establishTime,
    duration: 0,
    placeId: null,
    participantIds: [rel.id],
    content: `关系建立：${relName}`,
    impacts: {
      attributeChanges: [
        {
          entityType: "thing",
          entityId: rel.id,
          attribute: "$age",
          value: 0,
        },
        {
          entityType: "thing",
          entityId: rel.id,
          attribute: "$name",
          value: relName,
        },
      ],
      relationshipChanges: [],
      relationshipAttributeChanges: [],
    },
    system: true,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putEvent(establishEvent);

  return rel;
}

export async function list(worldId: string): Promise<Relationship[]> {
  const items = await repo.listRelationships(worldId);
  return items as Relationship[];
}

export async function getById(
  worldId: string,
  relId: string,
): Promise<Relationship> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  return item as Relationship;
}

export async function listByEntity(entityId: string): Promise<Relationship[]> {
  const items = await repo.listRelationshipsByEntity(entityId);
  return items as Relationship[];
}

export async function remove(
  worldId: string,
  relId: string,
): Promise<void> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  await repo.deleteRelationship(item as Relationship);
}

import {
  createId,
  EntityPrefix,
  RelationshipSchema,
  EventSchema,
  type Relationship,
  type CreateRelationshipBody,
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

  // 自动创建「建立」事件（含 $age=0 的属性变更）
  const establishEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.establishTime,
    duration: 0,
    placeId: null,
    participantIds: [rel.id],
    content: `关系建立`,
    impacts: {
      attributeChanges: [
        {
          entityType: "thing",
          entityId: rel.id,
          attribute: "$age",
          value: 0,
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

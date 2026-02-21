import {
  type Character,
  type CreateRelationshipBody,
  createId,
  type EndEntityBody,
  EntityPrefix,
  type Event,
  EventLinkSchema,
  EventSchema,
  type Relationship,
  RelationshipSchema,
  type TaxonomyNode,
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
  const typeNode = (await repo.getTaxonomyNode(
    worldId,
    "REL",
    body.typeNodeId,
  )) as TaxonomyNode | null;
  const typeName = typeNode?.name ?? "未知类型";
  // from/to 可能是角色或事物
  const fromChar = (await repo.getCharacter(
    worldId,
    body.fromId,
  )) as Character | null;
  const fromThing = fromChar
    ? null
    : ((await repo.getThing(worldId, body.fromId)) as Thing | null);
  const fromName = fromChar?.name ?? fromThing?.name ?? body.fromId;
  const toChar = (await repo.getCharacter(
    worldId,
    body.toId,
  )) as Character | null;
  const toThing = toChar
    ? null
    : ((await repo.getThing(worldId, body.toId)) as Thing | null);
  const toName = toChar?.name ?? toThing?.name ?? body.toId;
  const relName = `${typeName}·${fromName}·${toName}`;

  // 自动创建「建立」事件（含 $age=0, $name, $alive=true 的属性变更）
  const establishEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.establishTime,
    duration: 0,
    placeId: null,
    content: `关系建立：${relName}`,
    impacts: {
      attributeChanges: [
        {
          entityId: rel.id,
          attribute: "$age",
          value: 0,
        },
        {
          entityId: rel.id,
          attribute: "$name",
          value: relName,
        },
        {
          entityId: rel.id,
          attribute: "$alive",
          value: true,
        },
      ],
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
  return (items as Relationship[]).filter((r) => !r.deletedAt);
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

export async function remove(worldId: string, relId: string): Promise<void> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  // 软删除：不真正移除记录，保留引用完整性
  await repo.updateRelationship(worldId, relId, {
    deletedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// 消亡事件
// ---------------------------------------------------------------------------

export async function end(
  worldId: string,
  relId: string,
  body: EndEntityBody,
): Promise<Relationship> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  const r = item as Relationship;
  if (r.endEventId) throw AppError.badRequest("该关系已有消亡事件");

  // 解除时间必须晚于建立时间（实体事件索引按时间排序，第一条即建立事件）
  const entityEvents = await repo.listEventsByEntity(relId);
  const firstEntry = entityEvents[0] as { eventId: string } | undefined;
  if (firstEntry) {
    const birthEvent = (await repo.getEventById(
      worldId,
      firstEntry.eventId,
    )) as Event | null;
    if (birthEvent && body.time <= birthEvent.time) {
      throw AppError.badRequest("解除时间必须晚于建立时间");
    }
  }

  const now = new Date().toISOString();
  const endEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.time,
    duration: 0,
    placeId: null,
    content: body.content ?? `关系解除`,
    impacts: {
      attributeChanges: [
        {
          entityId: relId,
          attribute: "$alive",
          value: false,
        },
      ],
      relationshipAttributeChanges: [],
    },
    system: true,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putEvent(endEvent);

  if (body.causeEventId) {
    const [eidA, eidB] = [body.causeEventId, endEvent.id].sort();
    const link = EventLinkSchema.parse({
      worldId,
      eventIdA: eidA,
      eventIdB: eidB,
      description: `导致关系解除`,
    });
    await repo.putEventLink(link);
  }

  await repo.updateRelationship(worldId, relId, {
    endEventId: endEvent.id,
    updatedAt: now,
  });
  return (await repo.getRelationship(worldId, relId)) as Relationship;
}

export async function undoEnd(
  worldId: string,
  relId: string,
): Promise<Relationship> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  const r = item as Relationship;
  if (!r.endEventId) throw AppError.badRequest("该关系没有消亡事件");

  const endEvt = await repo.getEventById(worldId, r.endEventId);
  if (endEvt) {
    await repo.deleteEvent(endEvt as Event);
    const links = await repo.listEventLinks(worldId);
    for (const link of links) {
      const l = link as { eventIdA: string; eventIdB: string };
      if (l.eventIdA === r.endEventId || l.eventIdB === r.endEventId) {
        await repo.deleteEventLink(worldId, l.eventIdA, l.eventIdB);
      }
    }
  }

  const now = new Date().toISOString();
  await repo.updateRelationship(worldId, relId, {
    endEventId: null,
    updatedAt: now,
  });
  return (await repo.getRelationship(worldId, relId)) as Relationship;
}

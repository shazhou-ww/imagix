import {
  createId,
  EntityPrefix,
  CharacterSchema,
  EventSchema,
  EventLinkSchema,
  type Character,
  type Relationship,
  type Event,
  type CreateCharacterBody,
  type UpdateCharacterBody,
  type EndEntityBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  body: CreateCharacterBody,
): Promise<Character> {
  const now = new Date().toISOString();
  const char = CharacterSchema.parse({
    id: createId(EntityPrefix.Character),
    worldId,
    name: body.name,
    categoryNodeId: body.categoryNodeId,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putCharacter(char);

  // 自动创建诞生事件（含 $age=0, $name, $alive=true 的属性变更）
  const birthEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.birthTime,
    duration: 0,
    placeId: null,
    content: `${body.name}诞生`,
    impacts: {
      attributeChanges: [
        {
          entityId: char.id,
          attribute: "$age",
          value: 0,
        },
        {
          entityId: char.id,
          attribute: "$name",
          value: body.name,
        },
        {
          entityId: char.id,
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
  await repo.putEvent(birthEvent);

  return char;
}

export async function list(worldId: string): Promise<Character[]> {
  const items = await repo.listCharacters(worldId);
  return (items as Character[]).filter((c) => !c.deletedAt);
}

export async function getById(
  worldId: string,
  charId: string,
): Promise<Character> {
  const item = await repo.getCharacter(worldId, charId);
  if (!item) throw AppError.notFound("Character");
  return item as Character;
}

export async function update(
  worldId: string,
  charId: string,
  body: UpdateCharacterBody,
): Promise<Character> {
  const existing = await repo.getCharacter(worldId, charId);
  if (!existing) throw AppError.notFound("Character");
  await repo.updateCharacter(worldId, charId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getCharacter(worldId, charId)) as Character;
}

export async function remove(worldId: string, charId: string): Promise<void> {
  const existing = await repo.getCharacter(worldId, charId);
  if (!existing) throw AppError.notFound("Character");
  const now = new Date().toISOString();

  // 级联软删除该角色关联的所有关系
  const rels = (await repo.listRelationshipsByEntity(charId)) as Relationship[];
  for (const rel of rels) {
    if (!rel.deletedAt) {
      await repo.updateRelationship(worldId, rel.id, { deletedAt: now });
    }
  }

  await repo.updateCharacter(worldId, charId, { deletedAt: now });
}

// ---------------------------------------------------------------------------
// 消亡事件
// ---------------------------------------------------------------------------

export async function end(
  worldId: string,
  charId: string,
  body: EndEntityBody,
): Promise<Character> {
  const char = await repo.getCharacter(worldId, charId);
  if (!char) throw AppError.notFound("Character");
  const c = char as Character;
  if (c.endEventId) throw AppError.badRequest("该角色已有消亡事件");

  // 消亡时间必须晚于创生时间（实体事件索引按时间排序，第一条即创生事件）
  const entityEvents = await repo.listEventsByEntity(charId);
  const firstEntry = entityEvents[0] as { eventId: string } | undefined;
  if (firstEntry) {
    const birthEvent = (await repo.getEventById(worldId, firstEntry.eventId)) as Event | null;
    if (birthEvent && body.time <= birthEvent.time) {
      throw AppError.badRequest("消亡时间必须晚于创生时间");
    }
  }

  const now = new Date().toISOString();
  const endEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.time,
    duration: 0,
    placeId: null,
    content: body.content ?? `${c.name}消亡`,
    impacts: {
      attributeChanges: [
        {
          entityId: charId,
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

  // 若指定了因果事件，自动创建事件关联
  if (body.causeEventId) {
    const [eidA, eidB] = [body.causeEventId, endEvent.id].sort();
    const link = EventLinkSchema.parse({
      worldId,
      eventIdA: eidA,
      eventIdB: eidB,
      description: `导致${c.name}消亡`,
    });
    await repo.putEventLink(link);
  }

  await repo.updateCharacter(worldId, charId, {
    endEventId: endEvent.id,
    updatedAt: now,
  });
  return (await repo.getCharacter(worldId, charId)) as Character;
}

export async function undoEnd(
  worldId: string,
  charId: string,
): Promise<Character> {
  const char = await repo.getCharacter(worldId, charId);
  if (!char) throw AppError.notFound("Character");
  const c = char as Character;
  if (!c.endEventId) throw AppError.badRequest("该角色没有消亡事件");

  // 删除消亡事件
  const endEvt = await repo.getEventById(worldId, c.endEventId);
  if (endEvt) {
    await repo.deleteEvent(endEvt as Event);
    // 清理相关的 EventLink
    const links = await repo.listEventLinks(worldId);
    for (const link of links) {
      const l = link as { eventIdA: string; eventIdB: string };
      if (l.eventIdA === c.endEventId || l.eventIdB === c.endEventId) {
        await repo.deleteEventLink(worldId, l.eventIdA, l.eventIdB);
      }
    }
  }

  const now = new Date().toISOString();
  await repo.updateCharacter(worldId, charId, {
    endEventId: null,
    updatedAt: now,
  });
  return (await repo.getCharacter(worldId, charId)) as Character;
}

import {
  type Character,
  type CreateEventBody,
  createId,
  EntityPrefix,
  type Event,
  EventSchema,
  type Relationship,
  type StateImpact,
  type Thing,
  type UpdateEventBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { extractAffectedEntityIds } from "../db/repository.js";
import { AppError } from "./errors.js";

// ---------------------------------------------------------------------------
// Helpers — impacts 引用完整性验证
// ---------------------------------------------------------------------------

/** Resolve entity by prefixed ID. */
async function getEntityByPrefixedId(
  worldId: string,
  entityId: string,
): Promise<(Character | Thing | Relationship) | null> {
  const prefix = entityId.slice(0, 3);
  if (prefix === "chr")
    return (await repo.getCharacter(worldId, entityId)) as Character | null;
  if (prefix === "thg")
    return (await repo.getThing(worldId, entityId)) as Thing | null;
  if (prefix === "rel")
    return (await repo.getRelationship(
      worldId,
      entityId,
    )) as Relationship | null;
  return null;
}

/**
 * 验证 impacts 引用完整性。
 * 1. 实体/关系必须存在且未软删除
 * 2. 实体在事件时间点必须存续（未消亡），例外：创生/消亡事件本身
 * 3. $ 前缀属性仅允许系统事件修改
 */
async function validateImpacts(
  worldId: string,
  impacts: StateImpact,
  eventTime: number,
  isSystem: boolean,
): Promise<void> {
  for (const ac of impacts.attributeChanges) {
    const entity = await getEntityByPrefixedId(worldId, ac.entityId);
    if (!entity) throw AppError.badRequest(`实体 ${ac.entityId} 不存在`);
    if ((entity as { deletedAt?: string }).deletedAt) {
      throw AppError.badRequest(`实体 ${ac.entityId} 已被删除`);
    }

    if (ac.attribute.startsWith("$") && !isSystem) {
      throw AppError.badRequest(`系统属性 ${ac.attribute} 不允许普通事件修改`);
    }

    // 存续性校验（跳过 $alive 变更本身——创生/消亡事件）
    if (ac.attribute !== "$alive") {
      const endEventId = (entity as { endEventId?: string }).endEventId;
      if (endEventId) {
        const endEvt = await repo.getEventById(worldId, endEventId);
        if (endEvt && eventTime > (endEvt as Event).time) {
          throw AppError.badRequest(`实体 ${ac.entityId} 在该时间已消亡`);
        }
      }
    }
  }

  for (const rac of impacts.relationshipAttributeChanges) {
    const rel = (await repo.getRelationship(
      worldId,
      rac.relationshipId,
    )) as Relationship | null;
    if (!rel) throw AppError.badRequest(`关系 ${rac.relationshipId} 不存在`);
    if (rel.deletedAt)
      throw AppError.badRequest(`关系 ${rac.relationshipId} 已被删除`);

    if (rac.attribute.startsWith("$") && !isSystem) {
      throw AppError.badRequest(`系统属性 ${rac.attribute} 不允许普通事件修改`);
    }
  }
}

// ---------------------------------------------------------------------------
// System event detection helpers (impacts-based, no participantIds)
// ---------------------------------------------------------------------------

function isEpochEvent(evt: Event): boolean {
  return evt.system && evt.impacts.attributeChanges.length === 0;
}

function isBirthEvent(evt: Event): boolean {
  return (
    evt.system &&
    evt.impacts.attributeChanges.some(
      (ac) => ac.attribute === "$alive" && ac.value === true,
    )
  );
}

function isEndEvent(evt: Event): boolean {
  return (
    evt.system &&
    evt.impacts.attributeChanges.some(
      (ac) => ac.attribute === "$alive" && ac.value === false,
    )
  );
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function create(
  worldId: string,
  body: CreateEventBody,
): Promise<Event> {
  const impacts = body.impacts ?? {
    attributeChanges: [],
    relationshipAttributeChanges: [],
  };

  // 验证 impacts 引用完整性
  if (
    impacts.attributeChanges.length > 0 ||
    impacts.relationshipAttributeChanges.length > 0
  ) {
    await validateImpacts(worldId, impacts, body.time, false);
  }

  const now = new Date().toISOString();
  const evt = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.time,
    duration: body.duration ?? 0,
    placeId: body.placeId ?? null,
    content: body.content,
    impacts,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putEvent(evt);
  return evt;
}

export async function list(
  worldId: string,
  opts?: { timeFrom?: number; timeTo?: number },
): Promise<Event[]> {
  const items = await repo.listEvents(worldId, opts);
  return items as Event[];
}

export async function getById(
  worldId: string,
  eventId: string,
): Promise<Event> {
  const item = await repo.getEventById(worldId, eventId);
  if (!item) throw AppError.notFound("Event");
  return item as Event;
}

export async function update(
  worldId: string,
  eventId: string,
  body: UpdateEventBody,
): Promise<Event> {
  const existing = await repo.getEventById(worldId, eventId);
  if (!existing) throw AppError.notFound("Event");

  const old = existing as Event;

  // 系统事件编辑限制：
  // 纪元事件：只允许修改 content
  // 创生/消亡事件：允许修改 time 和 content，impacts 不可变
  // 普通事件：全部可改
  let safeBody: typeof body;
  if (old.system) {
    if (isEpochEvent(old)) {
      safeBody = { content: body.content };
    } else {
      safeBody = {
        time: body.time,
        content: body.content,
        impacts: old.impacts,
      };
    }
  } else {
    safeBody = body;
  }

  const newTime = safeBody.time ?? old.time;

  // 普通事件 impacts 变更验证
  if (!old.system && safeBody.impacts) {
    await validateImpacts(worldId, safeBody.impacts, newTime, false);
  }

  // 系统事件修改时间：创生/消亡事件之间的时序约束
  if (old.system && safeBody.time !== undefined && safeBody.time !== old.time) {
    const affectedIds = extractAffectedEntityIds(old);

    if (isBirthEvent(old)) {
      for (const eid of affectedIds) {
        const entity = await getEntityByPrefixedId(worldId, eid);
        const endEventId = (entity as { endEventId?: string } | null)
          ?.endEventId;
        if (endEventId) {
          const endEvt = (await repo.getEventById(
            worldId,
            endEventId,
          )) as Event | null;
          if (endEvt && safeBody.time != null && safeBody.time >= endEvt.time) {
            throw AppError.badRequest("创生时间必须早于消亡时间");
          }
        }
      }
    } else if (isEndEvent(old)) {
      for (const eid of affectedIds) {
        const entityEvents = await repo.listEventsByEntity(eid);
        const firstEntry = entityEvents[0] as { eventId: string } | undefined;
        if (firstEntry) {
          const birthEvt = (await repo.getEventById(
            worldId,
            firstEntry.eventId,
          )) as Event | null;
          if (
            birthEvt &&
            birthEvt.id !== eventId &&
            safeBody.time != null &&
            safeBody.time <= birthEvt.time
          ) {
            throw AppError.badRequest("消亡时间必须晚于创生时间");
          }
        }
      }
    }
  }

  const merged = EventSchema.parse({
    ...old,
    ...safeBody,
    updatedAt: new Date().toISOString(),
  });

  // time or impacts changed → delete old denorm items, rewrite all
  if (body.time !== undefined || body.impacts !== undefined) {
    await repo.deleteEvent(old);
  }
  await repo.putEvent(merged);
  return merged;
}

export async function remove(worldId: string, eventId: string): Promise<void> {
  const existing = await repo.getEventById(worldId, eventId);
  if (!existing) throw AppError.notFound("Event");
  const evt = existing as Event;

  if (evt.system) {
    if (!isEndEvent(evt)) {
      throw AppError.forbidden("系统预置事件不可删除（创生事件和纪元事件）");
    }

    // 清理实体上的 endEventId 引用
    const affectedIds = extractAffectedEntityIds(evt);
    for (const eid of affectedIds) {
      const prefix = eid.slice(0, 3);
      if (prefix === "chr") {
        const c = (await repo.getCharacter(worldId, eid)) as Character | null;
        if (c?.endEventId === eventId) {
          await repo.updateCharacter(worldId, eid, {
            endEventId: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (prefix === "thg") {
        const t = (await repo.getThing(worldId, eid)) as Thing | null;
        if (t?.endEventId === eventId) {
          await repo.updateThing(worldId, eid, {
            endEventId: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (prefix === "rel") {
        const r = (await repo.getRelationship(
          worldId,
          eid,
        )) as Relationship | null;
        if (r?.endEventId === eventId) {
          await repo.updateRelationship(worldId, eid, {
            endEventId: null,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  await repo.deleteEvent(evt);

  // 清理该事件的所有 EventLink
  const links = await repo.listEventLinks(worldId);
  for (const link of links) {
    const l = link as { eventIdA: string; eventIdB: string };
    if (l.eventIdA === eventId || l.eventIdB === eventId) {
      await repo.deleteEventLink(worldId, l.eventIdA, l.eventIdB);
    }
  }
}

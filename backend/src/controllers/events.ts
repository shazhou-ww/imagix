import {
  createId,
  EntityPrefix,
  EventSchema,
  type Event,
  type Character,
  type Thing,
  type Relationship,
  type CreateEventBody,
  type UpdateEventBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

// ---------------------------------------------------------------------------
// Helpers — 参与者存续时间校验
// ---------------------------------------------------------------------------

/**
 * 校验参与者在事件时间点是否存续。
 * 规则：若实体有消亡事件且消亡时间 < eventTime，则不允许参与。
 */
async function validateParticipantsAlive(
  worldId: string,
  participantIds: string[],
  eventTime: number,
): Promise<void> {
  for (const pid of participantIds) {
    const prefix = pid.slice(0, 3);
    let endEventId: string | undefined;

    if (prefix === "chr") {
      const c = (await repo.getCharacter(worldId, pid)) as Character | null;
      if (!c) throw AppError.badRequest(`参与者 ${pid} 不存在`);
      if (c.deletedAt) throw AppError.badRequest(`参与者 ${pid} 已被删除`);
      endEventId = c.endEventId;
    } else if (prefix === "thg") {
      const t = (await repo.getThing(worldId, pid)) as Thing | null;
      if (!t) throw AppError.badRequest(`参与者 ${pid} 不存在`);
      if (t.deletedAt) throw AppError.badRequest(`参与者 ${pid} 已被删除`);
      endEventId = t.endEventId;
    } else if (prefix === "rel") {
      const r = (await repo.getRelationship(worldId, pid)) as Relationship | null;
      if (!r) throw AppError.badRequest(`参与者 ${pid} 不存在`);
      if (r.deletedAt) throw AppError.badRequest(`参与者 ${pid} 已被删除`);
      endEventId = r.endEventId;
    }

    if (endEventId) {
      const endEvt = await repo.getEventById(worldId, endEventId);
      if (endEvt) {
        const endTime = (endEvt as Event).time;
        if (eventTime > endTime) {
          throw AppError.badRequest(
            `参与者 ${pid} 在时间 ${endTime} 已消亡，不能参与时间 ${eventTime} 的事件`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function create(
  worldId: string,
  body: CreateEventBody,
): Promise<Event> {
  const participants = body.participantIds ?? [];

  // 校验参与者在事件时间点是否存续
  if (participants.length > 0) {
    await validateParticipantsAlive(worldId, participants, body.time);
  }

  const now = new Date().toISOString();
  const evt = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.time,
    duration: body.duration ?? 0,
    placeId: body.placeId ?? null,
    participantIds: participants,
    content: body.content,
    impacts: body.impacts ?? {
      attributeChanges: [],
      relationshipAttributeChanges: [],
    },
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

  // 纪元事件（无参与者的系统事件）：只允许修改描述
  // 创建/消亡事件（有参与者的系统事件）：允许修改时间和描述，但参与者/属性/持续时间不可变
  // 普通事件：全部可改
  let safeBody: typeof body;
  if (old.system) {
    const isEpoch = old.participantIds.length === 0;
    if (isEpoch) {
      safeBody = { content: body.content };
    } else {
      safeBody = { time: body.time, content: body.content, participantIds: old.participantIds, impacts: old.impacts };
    }
  } else {
    safeBody = body;
  }

  // 若修改了参与者或时间，校验存续时间
  const newParticipants = safeBody.participantIds ?? old.participantIds;
  const newTime = safeBody.time ?? old.time;
  if (
    !old.system &&
    (safeBody.participantIds !== undefined || safeBody.time !== undefined) &&
    newParticipants.length > 0
  ) {
    await validateParticipantsAlive(worldId, newParticipants, newTime);
  }

  // 系统事件修改时间：创生/消亡事件之间的时序约束
  if (old.system && safeBody.time !== undefined && safeBody.time !== old.time && old.participantIds.length > 0) {
    const isBirthEvent = old.impacts.attributeChanges.some(
      (ac) => ac.attribute === "$alive" && ac.value === true,
    );
    const isEndEvent = old.impacts.attributeChanges.some(
      (ac) => ac.attribute === "$alive" && ac.value === false,
    );

    for (const pid of old.participantIds) {
      if (isBirthEvent) {
        // 修改创生事件时间：必须早于消亡事件时间
        const prefix = pid.slice(0, 3);
        let endEventId: string | undefined;
        if (prefix === "chr") endEventId = ((await repo.getCharacter(worldId, pid)) as Character | null)?.endEventId;
        else if (prefix === "thg") endEventId = ((await repo.getThing(worldId, pid)) as Thing | null)?.endEventId;
        else if (prefix === "rel") endEventId = ((await repo.getRelationship(worldId, pid)) as Relationship | null)?.endEventId;
        if (endEventId) {
          const endEvt = (await repo.getEventById(worldId, endEventId)) as Event | null;
          if (endEvt && safeBody.time >= endEvt.time) {
            throw AppError.badRequest("创生时间必须早于消亡时间");
          }
        }
      } else if (isEndEvent) {
        // 修改消亡事件时间：必须晚于创生事件时间
        const entityEvents = await repo.listEventsByEntity(pid);
        const firstEntry = entityEvents[0] as { eventId: string } | undefined;
        if (firstEntry) {
          const birthEvt = (await repo.getEventById(worldId, firstEntry.eventId)) as Event | null;
          if (birthEvt && birthEvt.id !== eventId && safeBody.time <= birthEvt.time) {
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

  // time or participants changed → delete old denorm items, rewrite all
  if (body.time !== undefined || body.participantIds !== undefined) {
    await repo.deleteEvent(old);
  }
  await repo.putEvent(merged);
  return merged;
}

export async function remove(
  worldId: string,
  eventId: string,
): Promise<void> {
  const existing = await repo.getEventById(worldId, eventId);
  if (!existing) throw AppError.notFound("Event");
  const evt = existing as Event;

  if (evt.system) {
    // 消亡事件（系统事件，但含 $alive=false 的 impact）可删除
    // 通过检查 impacts 中是否有 $alive=false 来判断
    const isEndEvent = evt.impacts.attributeChanges.some(
      (ac) => ac.attribute === "$alive" && ac.value === false,
    );
    if (!isEndEvent) {
      throw AppError.forbidden("系统预置事件不可删除（创生事件和纪元事件）");
    }

    // 清理实体上的 endEventId 引用
    for (const pid of evt.participantIds) {
      const prefix = pid.slice(0, 3);
      if (prefix === "chr") {
        const c = (await repo.getCharacter(worldId, pid)) as Character | null;
        if (c?.endEventId === eventId) {
          await repo.updateCharacter(worldId, pid, { endEventId: null, updatedAt: new Date().toISOString() });
        }
      } else if (prefix === "thg") {
        const t = (await repo.getThing(worldId, pid)) as Thing | null;
        if (t?.endEventId === eventId) {
          await repo.updateThing(worldId, pid, { endEventId: null, updatedAt: new Date().toISOString() });
        }
      } else if (prefix === "rel") {
        const r = (await repo.getRelationship(worldId, pid)) as Relationship | null;
        if (r?.endEventId === eventId) {
          await repo.updateRelationship(worldId, pid, { endEventId: null, updatedAt: new Date().toISOString() });
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

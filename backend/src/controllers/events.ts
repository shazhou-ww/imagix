import {
  createId,
  EntityPrefix,
  EventSchema,
  type Event,
  type CreateEventBody,
  type UpdateEventBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  body: CreateEventBody,
): Promise<Event> {
  const now = new Date().toISOString();
  const evt = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.time,
    placeId: body.placeId ?? null,
    participantIds: body.participantIds ?? [],
    content: body.content,
    impacts: body.impacts ?? {
      attributeChanges: [],
      relationshipChanges: [],
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

  // 系统预置事件只允许修改描述、参与者和属性影响（时间不可变）
  const safeBody = old.system
    ? { content: body.content, participantIds: body.participantIds, impacts: body.impacts }
    : body;

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
  if (evt.system) throw AppError.forbidden("系统预置事件不可删除");
  await repo.deleteEvent(evt);
}

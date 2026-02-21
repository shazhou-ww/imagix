import {
  createId,
  EntityPrefix,
  ThingSchema,
  EventSchema,
  EventLinkSchema,
  type Thing,
  type Event,
  type CreateThingBody,
  type UpdateThingBody,
  type EndEntityBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  body: CreateThingBody,
): Promise<Thing> {
  const now = new Date().toISOString();
  const thing = ThingSchema.parse({
    id: createId(EntityPrefix.Thing),
    worldId,
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putThing(thing);

  // 自动创建「创建」事件（含 $age=0, $name, $alive=true 的属性变更）
  const creationEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.creationTime,
    duration: 0,
    placeId: null,
    participantIds: [thing.id],
    content: `${body.name}创建`,
    impacts: {
      attributeChanges: [
        {
          entityType: "thing",
          entityId: thing.id,
          attribute: "$age",
          value: 0,
        },
        {
          entityType: "thing",
          entityId: thing.id,
          attribute: "$name",
          value: body.name,
        },
        {
          entityType: "thing",
          entityId: thing.id,
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
  await repo.putEvent(creationEvent);

  return thing;
}

export async function list(worldId: string): Promise<Thing[]> {
  const items = await repo.listThings(worldId);
  return (items as Thing[]).filter((t) => !t.deletedAt);
}

export async function getById(
  worldId: string,
  thingId: string,
): Promise<Thing> {
  const item = await repo.getThing(worldId, thingId);
  if (!item) throw AppError.notFound("Thing");
  return item as Thing;
}

export async function update(
  worldId: string,
  thingId: string,
  body: UpdateThingBody,
): Promise<Thing> {
  const existing = await repo.getThing(worldId, thingId);
  if (!existing) throw AppError.notFound("Thing");
  await repo.updateThing(worldId, thingId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getThing(worldId, thingId)) as Thing;
}

export async function remove(worldId: string, thingId: string): Promise<void> {
  const existing = await repo.getThing(worldId, thingId);
  if (!existing) throw AppError.notFound("Thing");
  await repo.updateThing(worldId, thingId, {
    deletedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// 消亡事件
// ---------------------------------------------------------------------------

export async function end(
  worldId: string,
  thingId: string,
  body: EndEntityBody,
): Promise<Thing> {
  const thing = await repo.getThing(worldId, thingId);
  if (!thing) throw AppError.notFound("Thing");
  const t = thing as Thing;
  if (t.endEventId) throw AppError.badRequest("该事物已有消亡事件");

  // 消亡时间必须晚于创生时间（实体事件索引按时间排序，第一条即创生事件）
  const entityEvents = await repo.listEventsByEntity(thingId);
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
    participantIds: [thingId],
    content: body.content ?? `${t.name}消亡`,
    impacts: {
      attributeChanges: [
        {
          entityType: "thing",
          entityId: thingId,
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
      description: `导致${t.name}消亡`,
    });
    await repo.putEventLink(link);
  }

  await repo.updateThing(worldId, thingId, {
    endEventId: endEvent.id,
    updatedAt: now,
  });
  return (await repo.getThing(worldId, thingId)) as Thing;
}

export async function undoEnd(
  worldId: string,
  thingId: string,
): Promise<Thing> {
  const thing = await repo.getThing(worldId, thingId);
  if (!thing) throw AppError.notFound("Thing");
  const t = thing as Thing;
  if (!t.endEventId) throw AppError.badRequest("该事物没有消亡事件");

  const endEvt = await repo.getEventById(worldId, t.endEventId);
  if (endEvt) {
    await repo.deleteEvent(endEvt as Event);
    const links = await repo.listEventLinks(worldId);
    for (const link of links) {
      const l = link as { eventIdA: string; eventIdB: string };
      if (l.eventIdA === t.endEventId || l.eventIdB === t.endEventId) {
        await repo.deleteEventLink(worldId, l.eventIdA, l.eventIdB);
      }
    }
  }

  const now = new Date().toISOString();
  await repo.updateThing(worldId, thingId, {
    endEventId: null,
    updatedAt: now,
  });
  return (await repo.getThing(worldId, thingId)) as Thing;
}

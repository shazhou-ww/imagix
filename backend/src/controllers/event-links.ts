import {
  EventLinkSchema,
  type EventLink,
  type CreateEventLinkBody,
  type DeleteEventLinkBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";

function normalize(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function create(
  worldId: string,
  body: CreateEventLinkBody,
): Promise<EventLink> {
  const [idA, idB] = normalize(body.eventIdA, body.eventIdB);
  const link = EventLinkSchema.parse({
    worldId,
    eventIdA: idA,
    eventIdB: idB,
    description: body.description ?? "",
  });
  await repo.putEventLink(link);
  return link;
}

export async function list(worldId: string): Promise<EventLink[]> {
  const items = await repo.listEventLinks(worldId);
  return items as EventLink[];
}

export async function remove(
  worldId: string,
  body: DeleteEventLinkBody,
): Promise<void> {
  const [idA, idB] = normalize(body.eventIdA, body.eventIdB);
  await repo.deleteEventLink(worldId, idA, idB);
}

import {
  createId,
  EntityPrefix,
  ThingSchema,
  type Thing,
  type CreateThingBody,
  type UpdateThingBody,
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
  return thing;
}

export async function list(worldId: string): Promise<Thing[]> {
  const items = await repo.listThings(worldId);
  return items as Thing[];
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
  await repo.deleteThing(worldId, thingId);
}

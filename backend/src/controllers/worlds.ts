import {
  createId,
  EntityPrefix,
  WorldSchema,
  EventSchema,
  type World,
  type CreateWorldBody,
  type UpdateWorldBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(userId: string, body: CreateWorldBody): Promise<World> {
  const now = new Date().toISOString();
  const world = WorldSchema.parse({
    id: createId(EntityPrefix.World),
    userId,
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putWorld(world);

  // 自动创建 time=0 的纪元事件
  const epochEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId: world.id,
    time: 0,
    placeId: null,
    participantIds: [],
    content: body.epoch,
    impacts: {
      attributeChanges: [],
      relationshipChanges: [],
      relationshipAttributeChanges: [],
    },
    createdAt: now,
    updatedAt: now,
  });
  await repo.putEvent(epochEvent);

  return world;
}

export async function list(userId: string): Promise<World[]> {
  const items = await repo.listWorldsByUser(userId);
  return items as World[];
}

export async function getById(worldId: string): Promise<World> {
  const item = await repo.getWorld(worldId);
  if (!item) throw AppError.notFound("World");
  return item as World;
}

export async function update(
  worldId: string,
  body: UpdateWorldBody,
): Promise<World> {
  await repo.getWorld(worldId).then((w) => {
    if (!w) throw AppError.notFound("World");
  });
  await repo.updateWorld(worldId, { ...body, updatedAt: new Date().toISOString() });
  return (await repo.getWorld(worldId)) as World;
}

export async function remove(worldId: string): Promise<void> {
  await repo.deleteWorld(worldId);
}

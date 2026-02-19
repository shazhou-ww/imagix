import {
  createId,
  EntityPrefix,
  StorySchema,
  type Story,
  type CreateStoryBody,
  type UpdateStoryBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  userId: string,
  body: CreateStoryBody,
): Promise<Story> {
  const now = new Date().toISOString();
  const story = StorySchema.parse({
    id: createId(EntityPrefix.Story),
    worldId,
    userId,
    ...body,
    chapterIds: [],
    createdAt: now,
    updatedAt: now,
  });
  await repo.putStory(story);
  return story;
}

export async function listByWorld(worldId: string): Promise<Story[]> {
  const items = await repo.listStoriesByWorld(worldId);
  return items as Story[];
}

export async function listByUser(userId: string): Promise<Story[]> {
  const items = await repo.listStoriesByUser(userId);
  return items as Story[];
}

export async function getById(
  worldId: string,
  storyId: string,
): Promise<Story> {
  const item = await repo.getStory(worldId, storyId);
  if (!item) throw AppError.notFound("Story");
  return item as Story;
}

export async function update(
  worldId: string,
  storyId: string,
  body: UpdateStoryBody,
): Promise<Story> {
  const existing = await repo.getStory(worldId, storyId);
  if (!existing) throw AppError.notFound("Story");
  await repo.updateStory(worldId, storyId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getStory(worldId, storyId)) as Story;
}

export async function remove(
  worldId: string,
  storyId: string,
): Promise<void> {
  await repo.deleteStory(worldId, storyId);
}

import {
  createId,
  EntityPrefix,
  ChapterSchema,
  type Chapter,
  type Story,
  type CreateChapterBody,
  type UpdateChapterBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  storyId: string,
  body: CreateChapterBody,
): Promise<Chapter> {
  const story = (await repo.getStory(worldId, storyId)) as Story | null;
  if (!story) throw AppError.notFound("Story");

  const now = new Date().toISOString();
  const chapter = ChapterSchema.parse({
    id: createId(EntityPrefix.Chapter),
    storyId,
    ...body,
    plotIds: [],
    createdAt: now,
    updatedAt: now,
  });
  await repo.putChapter(chapter);

  await repo.updateStory(worldId, storyId, {
    chapterIds: [...story.chapterIds, chapter.id],
    updatedAt: now,
  });

  return chapter;
}

export async function list(storyId: string): Promise<Chapter[]> {
  const items = await repo.listChapters(storyId);
  return items as Chapter[];
}

export async function getById(
  storyId: string,
  chapterId: string,
): Promise<Chapter> {
  const item = await repo.getChapter(storyId, chapterId);
  if (!item) throw AppError.notFound("Chapter");
  return item as Chapter;
}

export async function update(
  storyId: string,
  chapterId: string,
  body: UpdateChapterBody,
): Promise<Chapter> {
  const existing = await repo.getChapter(storyId, chapterId);
  if (!existing) throw AppError.notFound("Chapter");
  await repo.updateChapter(storyId, chapterId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getChapter(storyId, chapterId)) as Chapter;
}

export async function remove(
  worldId: string,
  storyId: string,
  chapterId: string,
): Promise<void> {
  const story = (await repo.getStory(worldId, storyId)) as Story | null;
  if (!story) throw AppError.notFound("Story");

  await repo.deleteChapter(storyId, chapterId);

  await repo.updateStory(worldId, storyId, {
    chapterIds: story.chapterIds.filter((id) => id !== chapterId),
    updatedAt: new Date().toISOString(),
  });
}

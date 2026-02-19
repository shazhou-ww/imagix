import {
  createId,
  EntityPrefix,
  CharacterSchema,
  type Character,
  type CreateCharacterBody,
  type UpdateCharacterBody,
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
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putCharacter(char);
  return char;
}

export async function list(worldId: string): Promise<Character[]> {
  const items = await repo.listCharacters(worldId);
  return items as Character[];
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
  await repo.deleteCharacter(worldId, charId);
}

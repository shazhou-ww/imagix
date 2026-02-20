import {
  createId,
  EntityPrefix,
  CharacterSchema,
  EventSchema,
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
    name: body.name,
    categoryNodeId: body.categoryNodeId,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putCharacter(char);

  // 自动创建出生事件（含年龄=0 的属性变更）
  const birthEvent = EventSchema.parse({
    id: createId(EntityPrefix.Event),
    worldId,
    time: body.birthTime,
    placeId: null,
    participantIds: [char.id],
    content: `${body.name}出生`,
    impacts: {
      attributeChanges: [
        {
          entityType: "character",
          entityId: char.id,
          attribute: "年龄",
          value: 0,
        },
      ],
      relationshipChanges: [],
      relationshipAttributeChanges: [],
    },
    createdAt: now,
    updatedAt: now,
  });
  await repo.putEvent(birthEvent);

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

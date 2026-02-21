import {
  type AttributeDefinition,
  AttributeDefinitionSchema,
  type CreateAttributeDefinitionBody,
  createId,
  EntityPrefix,
  type UpdateAttributeDefinitionBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function list(worldId: string): Promise<AttributeDefinition[]> {
  const items = await repo.listAttributeDefinitions(worldId);
  return items as AttributeDefinition[];
}

export async function create(
  worldId: string,
  body: CreateAttributeDefinitionBody,
): Promise<AttributeDefinition> {
  const now = new Date().toISOString();
  const attr = AttributeDefinitionSchema.parse({
    id: createId(EntityPrefix.AttributeDefinition),
    worldId,
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putAttributeDefinition(attr);
  return attr;
}

export async function update(
  worldId: string,
  adfId: string,
  body: UpdateAttributeDefinitionBody,
): Promise<AttributeDefinition> {
  const existing = await repo.getAttributeDefinition(worldId, adfId);
  if (!existing) throw AppError.notFound("AttributeDefinition");
  if ((existing as AttributeDefinition).system)
    throw AppError.forbidden("系统预置属性不可编辑");
  await repo.updateAttributeDefinition(worldId, adfId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getAttributeDefinition(
    worldId,
    adfId,
  )) as AttributeDefinition;
}

export async function remove(worldId: string, adfId: string): Promise<void> {
  const existing = await repo.getAttributeDefinition(worldId, adfId);
  if (existing && (existing as AttributeDefinition).system)
    throw AppError.forbidden("系统预置属性不可删除");
  await repo.deleteAttributeDefinition(worldId, adfId);
}

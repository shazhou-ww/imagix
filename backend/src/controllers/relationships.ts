import {
  createId,
  EntityPrefix,
  RelationshipSchema,
  type Relationship,
  type CreateRelationshipBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  body: CreateRelationshipBody,
): Promise<Relationship> {
  const now = new Date().toISOString();
  const rel = RelationshipSchema.parse({
    id: createId(EntityPrefix.Relationship),
    worldId,
    ...body,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putRelationship(rel);
  return rel;
}

export async function list(worldId: string): Promise<Relationship[]> {
  const items = await repo.listRelationships(worldId);
  return items as Relationship[];
}

export async function getById(
  worldId: string,
  relId: string,
): Promise<Relationship> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  return item as Relationship;
}

export async function listByEntity(entityId: string): Promise<Relationship[]> {
  const items = await repo.listRelationshipsByEntity(entityId);
  return items as Relationship[];
}

export async function remove(
  worldId: string,
  relId: string,
): Promise<void> {
  const item = await repo.getRelationship(worldId, relId);
  if (!item) throw AppError.notFound("Relationship");
  await repo.deleteRelationship(item as Relationship);
}

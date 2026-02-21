import {
  type CreatePlaceBody,
  createId,
  EntityPrefix,
  type Place,
  PlaceSchema,
  type UpdatePlaceBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  worldId: string,
  body: CreatePlaceBody,
): Promise<Place> {
  // 若指定了 parentId，验证父地点存在
  if (body.parentId) {
    const parent = await repo.getPlace(worldId, body.parentId);
    if (!parent) throw AppError.badRequest("父地点不存在");
  }

  const now = new Date().toISOString();
  const place = PlaceSchema.parse({
    id: createId(EntityPrefix.Place),
    worldId,
    name: body.name,
    parentId: body.parentId ?? null,
    description: body.description ?? "",
    createdAt: now,
    updatedAt: now,
  });
  await repo.putPlace(place);
  return place;
}

export async function list(worldId: string): Promise<Place[]> {
  const items = await repo.listPlaces(worldId);
  return items as Place[];
}

export async function getById(
  worldId: string,
  placeId: string,
): Promise<Place> {
  const item = await repo.getPlace(worldId, placeId);
  if (!item) throw AppError.notFound("Place");
  return item as Place;
}

export async function update(
  worldId: string,
  placeId: string,
  body: UpdatePlaceBody,
): Promise<Place> {
  const existing = await repo.getPlace(worldId, placeId);
  if (!existing) throw AppError.notFound("Place");

  // 若修改了 parentId，验证不会形成循环引用
  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === placeId) {
      throw AppError.badRequest("地点不能是自身的子地点");
    }
    const parent = await repo.getPlace(worldId, body.parentId);
    if (!parent) throw AppError.badRequest("父地点不存在");
  }

  await repo.updatePlace(worldId, placeId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getPlace(worldId, placeId)) as Place;
}

export async function remove(worldId: string, placeId: string): Promise<void> {
  const existing = await repo.getPlace(worldId, placeId);
  if (!existing) throw AppError.notFound("Place");

  // 检查是否有子地点引用
  const allPlaces = await repo.listPlaces(worldId);
  const hasChildren = (allPlaces as Place[]).some(
    (p) => p.parentId === placeId,
  );
  if (hasChildren) {
    throw AppError.badRequest("该地点下有子地点，请先删除或移动子地点");
  }

  await repo.deletePlace(worldId, placeId);
}

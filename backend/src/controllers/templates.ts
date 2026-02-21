import {
  createId,
  EntityPrefix,
  WorldTemplateSchema,
  TemplateSnapshotSchema,
  type WorldTemplate,
  type CreateTemplateBody,
  type UpdateTemplateBody,
  type CreateWorldFromTemplateBody,
  type World,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import * as worldCtrl from "./worlds.js";
import { AppError } from "./errors.js";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function create(
  userId: string,
  body: CreateTemplateBody,
): Promise<WorldTemplate> {
  const now = new Date().toISOString();
  const template = WorldTemplateSchema.parse({
    id: createId(EntityPrefix.Template),
    userId,
    name: body.name,
    description: body.description ?? "",
    snapshot: {
      world: { name: body.name, description: body.description ?? "", settings: "", epoch: "" },
      taxonomy: [],
      attributeDefinitions: [],
      places: [],
    },
    createdAt: now,
    updatedAt: now,
  });
  await repo.putTemplate(template);
  return template;
}

export async function list(userId: string): Promise<WorldTemplate[]> {
  const items = await repo.listTemplatesByUser(userId);
  return items as WorldTemplate[];
}

export async function getById(templateId: string): Promise<WorldTemplate> {
  const item = await repo.getTemplate(templateId);
  if (!item) throw AppError.notFound("Template");
  return item as WorldTemplate;
}

export async function update(
  templateId: string,
  userId: string,
  body: UpdateTemplateBody,
): Promise<WorldTemplate> {
  const existing = await repo.getTemplate(templateId);
  if (!existing) throw AppError.notFound("Template");
  if ((existing as WorldTemplate).userId !== userId) {
    throw AppError.forbidden("无权修改此模板");
  }
  await repo.updateTemplate(templateId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getTemplate(templateId)) as WorldTemplate;
}

export async function remove(templateId: string, userId: string): Promise<void> {
  const existing = await repo.getTemplate(templateId);
  if (!existing) throw AppError.notFound("Template");
  if ((existing as WorldTemplate).userId !== userId) {
    throw AppError.forbidden("无权删除此模板");
  }
  await repo.deleteTemplate(templateId);
}

// ---------------------------------------------------------------------------
// Save world as template
// ---------------------------------------------------------------------------

export async function saveWorldAsTemplate(
  userId: string,
  worldId: string,
  body: CreateTemplateBody,
): Promise<WorldTemplate> {
  // Verify world exists
  const world = await repo.getWorld(worldId);
  if (!world) throw AppError.notFound("World");

  const w = world as Record<string, unknown>;

  // Collect structural data
  const [charTree, thingTree, relTree, attributeDefinitions, places] =
    await Promise.all([
      repo.getTaxonomyTree(worldId, "CHAR"),
      repo.getTaxonomyTree(worldId, "THING"),
      repo.getTaxonomyTree(worldId, "REL"),
      repo.listAttributeDefinitions(worldId),
      repo.listPlaces(worldId),
    ]);

  const taxonomy = [...charTree, ...thingTree, ...relTree];

  // Strip DynamoDB key fields
  const strip = (items: Record<string, unknown>[]) =>
    items.map(({ pk, sk, gsi1pk, gsi1sk, ...rest }) => rest);

  const snapshot = TemplateSnapshotSchema.parse({
    world: {
      name: w.name,
      description: w.description ?? "",
      settings: w.settings ?? "",
      epoch: w.epoch ?? "",
    },
    taxonomy: strip(taxonomy as Record<string, unknown>[]),
    attributeDefinitions: strip(attributeDefinitions as Record<string, unknown>[]),
    places: strip(places as Record<string, unknown>[]),
  });

  const now = new Date().toISOString();
  const template = WorldTemplateSchema.parse({
    id: createId(EntityPrefix.Template),
    userId,
    name: body.name,
    description: body.description ?? "",
    sourceWorldId: worldId,
    snapshot,
    createdAt: now,
    updatedAt: now,
  });

  await repo.putTemplate(template);
  return template;
}

// ---------------------------------------------------------------------------
// Create world from template
// ---------------------------------------------------------------------------

export async function createWorldFromTemplate(
  userId: string,
  templateId: string,
  body: CreateWorldFromTemplateBody,
): Promise<World> {
  const tpl = await repo.getTemplate(templateId);
  if (!tpl) throw AppError.notFound("Template");
  const template = tpl as WorldTemplate;

  const snap = template.snapshot;
  const worldName = body.name ?? snap.world.name;
  const worldDescription = body.description ?? snap.world.description;
  const worldEpoch = body.epoch ?? (snap.world.epoch || "创世纪元");

  // Create the world using the existing world controller (handles presets)
  const world = await worldCtrl.create(userId, {
    name: worldName,
    description: worldDescription,
    settings: snap.world.settings,
    epoch: worldEpoch,
  });

  // Build ID mapping: old template IDs -> new world IDs
  const idMap = new Map<string, string>();

  // Get the system taxonomy nodes that were auto-created
  const [existingCharTree, existingThingTree, existingRelTree, existingAttrDefs] =
    await Promise.all([
      repo.getTaxonomyTree(world.id, "CHAR"),
      repo.getTaxonomyTree(world.id, "THING"),
      repo.getTaxonomyTree(world.id, "REL"),
      repo.listAttributeDefinitions(world.id),
    ]);

  // Map system node names to their IDs for deduplication
  const systemNodeMap = new Map<string, string>();
  for (const node of [...existingCharTree, ...existingThingTree, ...existingRelTree]) {
    const n = node as Record<string, unknown>;
    if (n.system) {
      systemNodeMap.set(`${n.tree}:${n.name}`, n.id as string);
    }
  }

  // Map system attribute definitions for deduplication
  const systemAttrMap = new Map<string, string>();
  for (const attr of existingAttrDefs) {
    const a = attr as Record<string, unknown>;
    if (a.system) {
      systemAttrMap.set(a.name as string, a.id as string);
    }
  }

  // Import taxonomy nodes (skip system nodes that already exist, map IDs)
  const taxonomyNodes = snap.taxonomy as Record<string, unknown>[];

  // First pass: create ID mapping for all nodes
  for (const raw of taxonomyNodes) {
    const oldId = raw.id as string;
    const tree = raw.tree as string;
    const name = raw.name as string;
    const isSystem = raw.system === true;

    if (isSystem) {
      const existingId = systemNodeMap.get(`${tree}:${name}`);
      if (existingId) {
        idMap.set(oldId, existingId);
        continue;
      }
    }
    const newId = createId(EntityPrefix.TaxonomyNode);
    idMap.set(oldId, newId);
  }

  // Second pass: create non-system nodes with remapped IDs
  for (const raw of taxonomyNodes) {
    const oldId = raw.id as string;
    const isSystem = raw.system === true;
    const tree = raw.tree as string;
    const name = raw.name as string;

    if (isSystem && systemNodeMap.has(`${tree}:${name}`)) {
      continue; // Skip system nodes that already exist
    }

    const { id: _id, worldId: _wid, ...rest } = raw;
    const newParentId = raw.parentId ? idMap.get(raw.parentId as string) ?? null : null;

    const { TaxonomyNodeSchema } = await import("@imagix/shared");
    const node = TaxonomyNodeSchema.parse({
      ...rest,
      id: idMap.get(oldId),
      worldId: world.id,
      parentId: newParentId,
    });
    await repo.putTaxonomyNode(node);
  }

  // Import attribute definitions (skip system ones)
  const attrDefs = snap.attributeDefinitions as Record<string, unknown>[];
  for (const raw of attrDefs) {
    const isSystem = raw.system === true;
    const name = raw.name as string;

    if (isSystem && systemAttrMap.has(name)) {
      continue; // Skip system attribute definitions
    }

    const { id: _id, worldId: _wid, ...rest } = raw;
    const newId = createId(EntityPrefix.AttributeDefinition);

    const { AttributeDefinitionSchema } = await import("@imagix/shared");
    const attr = AttributeDefinitionSchema.parse({
      ...rest,
      id: newId,
      worldId: world.id,
    });
    await repo.putAttributeDefinition(attr);
  }

  // Import places with remapped IDs
  const placeIdMap = new Map<string, string>();
  const places = snap.places as Record<string, unknown>[];

  // First pass: create ID mapping
  for (const raw of places) {
    placeIdMap.set(raw.id as string, createId(EntityPrefix.Place));
  }

  // Second pass: create places with remapped parent IDs
  for (const raw of places) {
    const { id: oldId, worldId: _wid, ...rest } = raw;
    const newParentId = raw.parentId
      ? placeIdMap.get(raw.parentId as string) ?? null
      : null;

    const { PlaceSchema } = await import("@imagix/shared");
    const place = PlaceSchema.parse({
      ...rest,
      id: placeIdMap.get(oldId as string),
      worldId: world.id,
      parentId: newParentId,
    });
    await repo.putPlace(place);
  }

  return world;
}

import { type ToolRegistry, jsonResult, okResult } from "../registry.js";
import * as charCtrl from "../../controllers/characters.js";
import * as thingCtrl from "../../controllers/things.js";
import * as placeCtrl from "../../controllers/places.js";
import * as relCtrl from "../../controllers/relationships.js";

const wid = { type: "string", description: "World ID" } as const;

export function registerEntityTools(registry: ToolRegistry) {
  // ── Characters ──────────────────────────────────────────────────────────

  registry.register({
    name: "list_characters",
    description: "List all characters in a world (excludes soft-deleted). Characters are agents with subjective agency (humans, animals, gods, etc.).",
    inputSchema: { type: "object", properties: { worldId: wid }, required: ["worldId"] },
    handler: async (a) => jsonResult(await charCtrl.list(a.worldId as string)),
  });

  registry.register({
    name: "create_character",
    description: "Create a character. Automatically creates a birth event at birthTime with $age=0, $name, $alive=true. Must reference a CHAR taxonomy node.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        name: { type: "string", description: "Character name" },
        categoryNodeId: { type: "string", description: "CHAR taxonomy node ID ('txn...')" },
        birthTime: { type: "number", description: "Birth time in epoch ms" },
      },
      required: ["worldId", "name", "categoryNodeId", "birthTime"],
    },
    handler: async (a) => jsonResult(await charCtrl.create(a.worldId as string, a as any)),
  });

  registry.register({
    name: "get_character",
    description: "Get a character's static metadata. Use compute_entity_state for dynamic attributes.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, characterId: { type: "string", description: "Character ID ('chr...')" } },
      required: ["worldId", "characterId"],
    },
    handler: async (a) => jsonResult(await charCtrl.getById(a.worldId as string, a.characterId as string)),
  });

  registry.register({
    name: "update_character",
    description: "Update a character's static metadata (name, categoryNodeId).",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        characterId: { type: "string", description: "Character ID" },
        name: { type: "string" },
        categoryNodeId: { type: "string" },
      },
      required: ["worldId", "characterId"],
    },
    handler: async (a) => {
      const { worldId, characterId, ...body } = a as any;
      return jsonResult(await charCtrl.update(worldId, characterId, body));
    },
  });

  registry.register({
    name: "delete_character",
    description: "Soft-delete a character.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, characterId: { type: "string" } },
      required: ["worldId", "characterId"],
    },
    handler: async (a) => { await charCtrl.remove(a.worldId as string, a.characterId as string); return okResult("Character deleted."); },
  });

  registry.register({
    name: "end_character",
    description: "Mark a character as dead. Creates a death event ($alive=false). Death time must be after birth time. Optionally link a cause event.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        characterId: { type: "string" },
        time: { type: "number", description: "Death time in epoch ms" },
        content: { type: "string", description: "Death event description" },
        causeEventId: { type: "string", description: "Cause event ID (creates event link)" },
      },
      required: ["worldId", "characterId", "time"],
    },
    handler: async (a) => {
      const { worldId, characterId, ...body } = a as any;
      return jsonResult(await charCtrl.end(worldId, characterId, body));
    },
  });

  registry.register({
    name: "undo_end_character",
    description: "Revive a character — delete the death event and associated links.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, characterId: { type: "string" } },
      required: ["worldId", "characterId"],
    },
    handler: async (a) => jsonResult(await charCtrl.undoEnd(a.worldId as string, a.characterId as string)),
  });

  // ── Things ──────────────────────────────────────────────────────────────

  registry.register({
    name: "list_things",
    description: "List all things in a world (excludes soft-deleted). Things are non-agent entities (artifacts, items, forces).",
    inputSchema: { type: "object", properties: { worldId: wid }, required: ["worldId"] },
    handler: async (a) => jsonResult(await thingCtrl.list(a.worldId as string)),
  });

  registry.register({
    name: "create_thing",
    description: "Create a thing. Automatically creates a creation event at creationTime with $age=0, $name, $alive=true. Must reference a THING taxonomy node.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        name: { type: "string", description: "Thing name" },
        categoryNodeId: { type: "string", description: "THING taxonomy node ID ('txn...')" },
        creationTime: { type: "number", description: "Creation time in epoch ms" },
      },
      required: ["worldId", "name", "categoryNodeId", "creationTime"],
    },
    handler: async (a) => jsonResult(await thingCtrl.create(a.worldId as string, a as any)),
  });

  registry.register({
    name: "get_thing",
    description: "Get a thing's static metadata.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, thingId: { type: "string", description: "Thing ID ('thg...')" } },
      required: ["worldId", "thingId"],
    },
    handler: async (a) => jsonResult(await thingCtrl.getById(a.worldId as string, a.thingId as string)),
  });

  registry.register({
    name: "update_thing",
    description: "Update a thing's static metadata.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, thingId: { type: "string" }, name: { type: "string" }, categoryNodeId: { type: "string" } },
      required: ["worldId", "thingId"],
    },
    handler: async (a) => {
      const { worldId, thingId, ...body } = a as any;
      return jsonResult(await thingCtrl.update(worldId, thingId, body));
    },
  });

  registry.register({
    name: "delete_thing",
    description: "Soft-delete a thing.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, thingId: { type: "string" } },
      required: ["worldId", "thingId"],
    },
    handler: async (a) => { await thingCtrl.remove(a.worldId as string, a.thingId as string); return okResult("Thing deleted."); },
  });

  registry.register({
    name: "end_thing",
    description: "Mark a thing as destroyed. Creates a destruction event ($alive=false).",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid, thingId: { type: "string" },
        time: { type: "number", description: "Destruction time in epoch ms" },
        content: { type: "string" }, causeEventId: { type: "string" },
      },
      required: ["worldId", "thingId", "time"],
    },
    handler: async (a) => {
      const { worldId, thingId, ...body } = a as any;
      return jsonResult(await thingCtrl.end(worldId, thingId, body));
    },
  });

  registry.register({
    name: "undo_end_thing",
    description: "Restore a destroyed thing — delete the destruction event.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, thingId: { type: "string" } },
      required: ["worldId", "thingId"],
    },
    handler: async (a) => jsonResult(await thingCtrl.undoEnd(a.worldId as string, a.thingId as string)),
  });

  // ── Places ──────────────────────────────────────────────────────────────

  registry.register({
    name: "list_places",
    description: "List all places in a world. Places are spatial containers with parent-child hierarchy. No lifecycle.",
    inputSchema: { type: "object", properties: { worldId: wid }, required: ["worldId"] },
    handler: async (a) => jsonResult(await placeCtrl.list(a.worldId as string)),
  });

  registry.register({
    name: "create_place",
    description: "Create a place. Nest via parentId for spatial hierarchy.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        name: { type: "string", description: "Place name" },
        parentId: { type: ["string", "null"], description: "Parent place ID (null for top-level)" },
        description: { type: "string" },
      },
      required: ["worldId", "name"],
    },
    handler: async (a) => jsonResult(await placeCtrl.create(a.worldId as string, { name: a.name as string, parentId: (a.parentId as string) ?? null, description: a.description as string })),
  });

  registry.register({
    name: "get_place",
    description: "Get a place's details.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, placeId: { type: "string", description: "Place ID ('plc...')" } },
      required: ["worldId", "placeId"],
    },
    handler: async (a) => jsonResult(await placeCtrl.getById(a.worldId as string, a.placeId as string)),
  });

  registry.register({
    name: "update_place",
    description: "Update a place. Cannot set a place as its own parent.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, placeId: { type: "string" }, name: { type: "string" }, parentId: { type: ["string", "null"] }, description: { type: "string" } },
      required: ["worldId", "placeId"],
    },
    handler: async (a) => {
      const { worldId, placeId, ...body } = a as any;
      return jsonResult(await placeCtrl.update(worldId, placeId, body));
    },
  });

  registry.register({
    name: "delete_place",
    description: "Delete a place (hard delete). Fails if has children.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, placeId: { type: "string" } },
      required: ["worldId", "placeId"],
    },
    handler: async (a) => { await placeCtrl.remove(a.worldId as string, a.placeId as string); return okResult("Place deleted."); },
  });

  // ── Entity ↔ Relationships ──────────────────────────────────────────────

  registry.register({
    name: "list_entity_relationships",
    description: "List all relationships involving a specific entity (as source or target).",
    inputSchema: {
      type: "object",
      properties: { entityId: { type: "string", description: "Entity ID (chr/thg/rel)" } },
      required: ["entityId"],
    },
    handler: async (a) => jsonResult(await relCtrl.listByEntity(a.entityId as string)),
  });
}

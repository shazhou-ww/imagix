import * as relCtrl from "../../controllers/relationships.js";
import { jsonResult, okResult, type ToolRegistry } from "../registry.js";

const wid = { type: "string", description: "World ID" } as const;

export function registerRelationshipTools(registry: ToolRegistry) {
  registry.register({
    name: "list_relationships",
    description:
      "List all relationships in a world (excludes soft-deleted). Relationships link two entities (characters/things) with a typed edge.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid },
      required: ["worldId"],
    },
    handler: async (a) => jsonResult(await relCtrl.list(a.worldId as string)),
  });

  registry.register({
    name: "create_relationship",
    description:
      "Create a relationship between two entities. Auto-creates an establishment event at establishTime with $age=0, $name, $alive=true.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        fromId: { type: "string", description: "Source entity ID (chr/thg)" },
        toId: { type: "string", description: "Target entity ID (chr/thg)" },
        typeNodeId: {
          type: "string",
          description: "REL taxonomy node ID ('txn...')",
        },
        establishTime: {
          type: "number",
          description: "Establishment time in epoch ms",
        },
      },
      required: ["worldId", "fromId", "toId", "typeNodeId", "establishTime"],
    },
    handler: async (a) =>
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      jsonResult(await relCtrl.create(a.worldId as string, a as any)),
  });

  registry.register({
    name: "get_relationship",
    description: "Get a relationship by ID.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        relationshipId: {
          type: "string",
          description: "Relationship ID ('rel...')",
        },
      },
      required: ["worldId", "relationshipId"],
    },
    handler: async (a) =>
      jsonResult(
        await relCtrl.getById(a.worldId as string, a.relationshipId as string),
      ),
  });

  registry.register({
    name: "delete_relationship",
    description: "Soft-delete a relationship.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, relationshipId: { type: "string" } },
      required: ["worldId", "relationshipId"],
    },
    handler: async (a) => {
      await relCtrl.remove(a.worldId as string, a.relationshipId as string);
      return okResult("Relationship deleted.");
    },
  });

  registry.register({
    name: "end_relationship",
    description:
      "Mark a relationship as ended. Creates an end event ($alive=false). End time must be after establishment time.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        relationshipId: { type: "string" },
        time: { type: "number", description: "End time in epoch ms" },
        content: { type: "string", description: "End event description" },
        causeEventId: {
          type: "string",
          description: "Cause event ID (creates event link)",
        },
      },
      required: ["worldId", "relationshipId", "time"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { worldId, relationshipId, ...body } = a as any;
      return jsonResult(await relCtrl.end(worldId, relationshipId, body));
    },
  });

  registry.register({
    name: "undo_end_relationship",
    description:
      "Undo ending a relationship — delete the end event and associated links.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, relationshipId: { type: "string" } },
      required: ["worldId", "relationshipId"],
    },
    handler: async (a) =>
      jsonResult(
        await relCtrl.undoEnd(a.worldId as string, a.relationshipId as string),
      ),
  });
}

import * as worldCtrl from "../../controllers/worlds.js";
import { jsonResult, okResult, type ToolRegistry } from "../registry.js";

export function registerWorldTools(registry: ToolRegistry) {
  registry.register({
    name: "list_worlds",
    description:
      "List all worlds owned by the current user. Returns an array of world objects with id, name, description, settings, epoch, and timestamps.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, ctx) =>
      jsonResult(await worldCtrl.list(ctx.userId)),
  });

  registry.register({
    name: "create_world",
    description:
      "Create a new story world. Automatically creates an epoch event at time=0, three taxonomy root nodes (CHAR, THING, REL) with sub-nodes, and three system attribute definitions ($age, $name, $alive). The 'epoch' field describes the origin of time in this world.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "World name" },
        description: { type: "string", description: "World description" },
        settings: {
          type: "string",
          description:
            "World settings: physical laws, power systems, social rules, etc.",
        },
        epoch: {
          type: "string",
          description:
            "Epoch description — the event at time=0 (e.g. 'Genesis')",
        },
      },
      required: ["name", "epoch"],
    },
    handler: async (args, ctx) => {
      return jsonResult(await worldCtrl.create(ctx.userId, args as any));
    },
  });

  registry.register({
    name: "get_world",
    description: "Get details of a specific world by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: {
          type: "string",
          description: "World ID (30-char ULID starting with 'wld')",
        },
      },
      required: ["worldId"],
    },
    handler: async (args) =>
      jsonResult(await worldCtrl.getById(args.worldId as string)),
  });

  registry.register({
    name: "update_world",
    description:
      "Update a world's metadata. Only provided fields are updated. If 'epoch' is changed, the epoch event content is also updated.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: { type: "string", description: "World ID" },
        name: { type: "string", description: "New world name" },
        description: { type: "string", description: "New world description" },
        settings: { type: "string", description: "New world settings" },
        epoch: { type: "string", description: "New epoch description" },
      },
      required: ["worldId"],
    },
    handler: async (args) => {
      const { worldId, ...body } = args as {
        worldId: string;
        [k: string]: unknown;
      };
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      return jsonResult(await worldCtrl.update(worldId, body as any));
    },
  });

  registry.register({
    name: "delete_world",
    description: "Delete a world and ALL its data (cascade). Cannot be undone.",
    inputSchema: {
      type: "object",
      properties: { worldId: { type: "string", description: "World ID" } },
      required: ["worldId"],
    },
    handler: async (args) => {
      await worldCtrl.remove(args.worldId as string);
      return okResult("World deleted successfully.");
    },
  });

  registry.register({
    name: "export_world",
    description:
      "Export all data from a world as JSON. Includes taxonomy, attributes, characters, things, places, relationships, events, event links, stories, chapters, and plots.",
    inputSchema: {
      type: "object",
      properties: { worldId: { type: "string", description: "World ID" } },
      required: ["worldId"],
    },
    handler: async (args) =>
      jsonResult(await worldCtrl.exportWorld(args.worldId as string)),
  });

  registry.register({
    name: "import_world",
    description: "Import data into an existing world. Upserts entities by ID.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: { type: "string", description: "Target world ID" },
        data: {
          type: "object",
          description: "Import data object with entity arrays",
        },
      },
      required: ["worldId", "data"],
    },
    handler: async (args) => {
      await worldCtrl.importWorld(
        args.worldId as string,
        args.data as Record<string, unknown>,
      );
      return okResult("Import completed successfully.");
    },
  });
}

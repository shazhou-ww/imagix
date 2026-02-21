import * as templateCtrl from "../../controllers/templates.js";
import { jsonResult, okResult, type ToolRegistry } from "../registry.js";

export function registerTemplateTools(registry: ToolRegistry) {
  registry.register({
    name: "list_templates",
    description:
      "List all world templates owned by the current user. Templates capture world structure (taxonomy, places, attribute defs) for reuse.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_a, ctx) =>
      jsonResult(await templateCtrl.list(ctx.userId)),
  });

  registry.register({
    name: "create_template",
    description: "Create an empty world template owned by the current user.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Template name" },
        description: { type: "string", description: "Template description" },
      },
      required: ["name"],
    },
    handler: async (a, ctx) => {
      return jsonResult(await templateCtrl.create(ctx.userId, a as any));
    },
  });

  registry.register({
    name: "get_template",
    description:
      "Get a template by ID, including its snapshot (world structure snapshot).",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "Template ID ('tpl...')" },
      },
      required: ["templateId"],
    },
    handler: async (a) =>
      jsonResult(await templateCtrl.getById(a.templateId as string)),
  });

  registry.register({
    name: "update_template",
    description: "Update a template's metadata. Only the owner can edit.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
      },
      required: ["templateId"],
    },
    handler: async (a, ctx) => {
      const { templateId, ...body } = a as any;
      return jsonResult(await templateCtrl.update(templateId, ctx.userId, body));
    },
  });

  registry.register({
    name: "delete_template",
    description: "Delete a template. Only the owner can delete.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string" },
      },
      required: ["templateId"],
    },
    handler: async (a, ctx) => {
      await templateCtrl.remove(a.templateId as string, ctx.userId);
      return okResult("Template deleted.");
    },
  });

  registry.register({
    name: "save_world_as_template",
    description:
      "Save an existing world's structure (taxonomy, places, attribute definitions) as a reusable template. " +
      "Does not copy entities, events, or stories.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: { type: "string", description: "Source world ID" },
        name: { type: "string", description: "Template name" },
        description: { type: "string" },
      },
      required: ["worldId", "name"],
    },
    handler: async (a, ctx) => {
      const { worldId, ...body } = a as any;
      return jsonResult(
        await templateCtrl.saveWorldAsTemplate(ctx.userId, worldId, body),
      );
    },
  });

  registry.register({
    name: "create_world_from_template",
    description:
      "Create a new world from a template. Copies taxonomy, places, and attribute definitions from the template's snapshot. " +
      "Optionally override name, description, and epoch.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string" },
        name: {
          type: "string",
          description: "Override world name (defaults to template name)",
        },
        description: { type: "string" },
        epoch: { type: "string", description: "Override epoch name" },
      },
      required: ["templateId"],
    },
    handler: async (a, ctx) => {
      const { templateId, ...body } = a as any;
      return jsonResult(
        await templateCtrl.createWorldFromTemplate(ctx.userId, templateId, body),
      );
    },
  });
}

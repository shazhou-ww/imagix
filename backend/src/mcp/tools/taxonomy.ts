import type { TaxonomyTree } from "@imagix/shared";
import * as attrDefCtrl from "../../controllers/attribute-definitions.js";
import * as taxonomyCtrl from "../../controllers/taxonomy.js";
import { jsonResult, okResult, type ToolRegistry } from "../registry.js";

const wid = { type: "string", description: "World ID" } as const;

export function registerTaxonomyTools(registry: ToolRegistry) {
  // ── Taxonomy ────────────────────────────────────────────────────────────

  registry.register({
    name: "get_taxonomy_tree",
    description:
      "Get a taxonomy tree for a world. Trees: CHAR (character categories), THING (thing categories), REL (relationship types). " +
      "Taxonomy nodes define categories with optional timeFormula (JSONata expression for age, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        tree: {
          type: "string",
          enum: ["CHAR", "THING", "REL"],
          description: "Taxonomy tree type",
        },
      },
      required: ["worldId", "tree"],
    },
    handler: async (a) =>
      jsonResult(
        await taxonomyCtrl.getTree(a.worldId as string, a.tree as TaxonomyTree),
      ),
  });

  registry.register({
    name: "create_taxonomy_node",
    description:
      "Create a taxonomy node. Nodes form a hierarchy via parentId. Use timeFormula (JSONata) for time-dependent attribute computation.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        tree: { type: "string", enum: ["CHAR", "THING", "REL"] },
        name: { type: "string", description: "Node name" },
        parentId: {
          type: ["string", "null"],
          description: "Parent node ID (null for root)",
        },
        timeFormula: {
          type: ["string", "null"],
          description: "JSONata expression for time-dependent attrs",
        },
      },
      required: ["worldId", "tree", "name"],
    },
    handler: async (a) =>
      jsonResult(
        await taxonomyCtrl.create(a.worldId as string, a.tree as TaxonomyTree, {
          name: a.name as string,
          parentId: (a.parentId as string) ?? null,
          timeFormula: (a.timeFormula as string) ?? null,
        }),
      ),
  });

  registry.register({
    name: "update_taxonomy_node",
    description:
      "Update a taxonomy node (name, parentId, timeFormula). System preset nodes cannot be edited.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        tree: { type: "string", enum: ["CHAR", "THING", "REL"] },
        nodeId: { type: "string", description: "Taxonomy node ID ('txn...')" },
        name: { type: "string" },
        parentId: { type: ["string", "null"] },
        timeFormula: { type: ["string", "null"] },
      },
      required: ["worldId", "tree", "nodeId"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { worldId, tree, nodeId, ...body } = a as any;
      return jsonResult(await taxonomyCtrl.update(worldId, tree, nodeId, body));
    },
  });

  registry.register({
    name: "delete_taxonomy_node",
    description:
      "Delete a taxonomy node. System preset nodes cannot be deleted.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        tree: { type: "string", enum: ["CHAR", "THING", "REL"] },
        nodeId: { type: "string" },
      },
      required: ["worldId", "tree", "nodeId"],
    },
    handler: async (a) => {
      await taxonomyCtrl.remove(
        a.worldId as string,
        a.tree as TaxonomyTree,
        a.nodeId as string,
      );
      return okResult("Taxonomy node deleted.");
    },
  });

  // ── Attribute Definitions ───────────────────────────────────────────────

  registry.register({
    name: "list_attribute_definitions",
    description:
      "List attribute definitions for a world. These define what attributes can exist on entities, with types, defaults, enums, etc.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid },
      required: ["worldId"],
    },
    handler: async (a) =>
      jsonResult(await attrDefCtrl.list(a.worldId as string)),
  });

  registry.register({
    name: "create_attribute_definition",
    description:
      "Create an attribute definition. Define custom attributes for entities (e.g. 'mood', 'power_level') with type and display info.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        name: { type: "string", description: "Attribute key name" },
        label: { type: "string", description: "Display label" },
        type: {
          type: "string",
          enum: ["string", "number", "boolean"],
          description: "Value type",
        },
        defaultValue: { description: "Default value (matches type)" },
        enumValues: {
          type: "array",
          items: { type: "string" },
          description: "Allowed values (string type only)",
        },
        scope: {
          type: "string",
          enum: ["entity", "relationship"],
          description: "Scope",
        },
      },
      required: ["worldId", "name", "label", "type", "scope"],
    },
    handler: async (a) =>
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      jsonResult(await attrDefCtrl.create(a.worldId as string, a as any)),
  });

  registry.register({
    name: "update_attribute_definition",
    description:
      "Update an attribute definition. System preset defs cannot be edited.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        attributeDefinitionId: {
          type: "string",
          description: "Attribute definition ID ('adf...')",
        },
        label: { type: "string" },
        type: { type: "string", enum: ["string", "number", "boolean"] },
        defaultValue: {},
        enumValues: { type: "array", items: { type: "string" } },
      },
      required: ["worldId", "attributeDefinitionId"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { worldId, attributeDefinitionId, ...body } = a as any;
      return jsonResult(
        await attrDefCtrl.update(worldId, attributeDefinitionId, body),
      );
    },
  });

  registry.register({
    name: "delete_attribute_definition",
    description:
      "Delete an attribute definition. System preset defs cannot be deleted.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, attributeDefinitionId: { type: "string" } },
      required: ["worldId", "attributeDefinitionId"],
    },
    handler: async (a) => {
      await attrDefCtrl.remove(
        a.worldId as string,
        a.attributeDefinitionId as string,
      );
      return okResult("Attribute definition deleted.");
    },
  });
}

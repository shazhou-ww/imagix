import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolRegistry } from "./registry.js";
import { registerEntityTools } from "./tools/entities.js";
import { registerEventTools } from "./tools/events.js";
import { registerNarrativeTools } from "./tools/narrative.js";
import { registerRelationshipTools } from "./tools/relationships.js";
import { registerStateTools } from "./tools/state.js";
import { registerTaxonomyTools } from "./tools/taxonomy.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerWorldTools } from "./tools/worlds.js";

/**
 * Build a pre-wired ToolRegistry with all Imagix tools registered.
 */
function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerWorldTools(registry);
  registerEntityTools(registry);
  registerRelationshipTools(registry);
  registerEventTools(registry);
  registerStateTools(registry);
  registerTaxonomyTools(registry);
  registerNarrativeTools(registry);
  registerTemplateTools(registry);
  return registry;
}

/**
 * Create a low-level MCP Server instance with all tool handlers wired.
 *
 * Uses the low-level `Server` API (not `McpServer`) to avoid Zod type inference
 * overhead that causes tsc to hang with 55+ tool registrations.
 */
export function createMcpServer(): Server {
  const registry = buildRegistry();

  const server = new Server(
    { name: "imagix-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return registry.callTool(name, args ?? {});
  });

  return server;
}

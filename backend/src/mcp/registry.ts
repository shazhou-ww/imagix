/**
 * Lightweight tool registry that avoids McpServer's Zod type gymnastics.
 * Tools are defined with plain JSON Schema and dispatched via a simple map.
 */

/** JSON Schema subset for tool input parameters */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/** A registered MCP tool */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

/** MCP tool call result — index signature satisfies ServerResult constraint */
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Tool registry — collects tools from all registration functions */
export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  /** Register a tool */
  register(tool: ToolDef): void {
    this.tools.set(tool.name, tool);
  }

  /** Get all tool definitions (for tools/list) */
  listTools(): Array<{
    name: string;
    description: string;
    inputSchema: JsonSchema;
  }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /** Dispatch a tool call (for tools/call) */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      return await tool.handler(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  }

  get size(): number {
    return this.tools.size;
  }
}

/** Helper to create a JSON text result */
export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Helper to create a success message result */
export function okResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }] };
}

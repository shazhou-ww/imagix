// ---------------------------------------------------------------------------
// AI Assistant – Frontend-only navigation tools
//
// These tools are NOT MCP tools — they execute locally in the browser.
// They share the same ToolDefinition shape so the LLM treats them uniformly.
// ---------------------------------------------------------------------------

import type { ToolDefinition, ToolResult } from "./types";
import { parsePageContext } from "./system-prompt";

// ---------------------------------------------------------------------------
// Tool definitions (sent to LLM)
// ---------------------------------------------------------------------------

export const NAVIGATION_TOOL_DEFS: ToolDefinition[] = [
  {
    name: "get_current_url",
    description:
      "获取用户当前浏览器页面的 URL 路径，以及从 URL 中解析出的上下文信息（如当前世界 ID、实体类型和 ID 等）。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "navigate_to",
    description:
      "导航到指定的页面路径。路径应以 / 开头，例如 /worlds/{worldId}/characters。",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "目标页面路径，如 /worlds/wld.../characters",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "get_page_context",
    description:
      "获取当前页面的上下文描述，包括当前所在的世界、正在查看的实体类型等信息。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/** Set of navigation tool names (used to distinguish from MCP tools) */
export const NAVIGATION_TOOL_NAMES = new Set(
  NAVIGATION_TOOL_DEFS.map((t) => t.name),
);

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

/**
 * Execute a navigation tool. Returns null if the tool name is not a
 * navigation tool (i.e. it should be handled by MCP instead).
 *
 * `navigate` is the react-router navigate function, injected by the caller.
 */
export function executeNavigationTool(
  name: string,
  args: Record<string, unknown>,
  currentPath: string,
  navigate: (path: string) => void,
): ToolResult | null {
  switch (name) {
    case "get_current_url":
      return {
        content: JSON.stringify({
          path: currentPath,
          context: parsePageContext(currentPath),
        }),
      };

    case "navigate_to": {
      const path = args.path as string;
      if (!path) {
        return { content: "错误：未提供目标路径", isError: true };
      }
      try {
        navigate(path);
        return {
          content: `已导航到 ${path}`,
        };
      } catch (e) {
        return {
          content: `导航失败：${e instanceof Error ? e.message : String(e)}`,
          isError: true,
        };
      }
    }

    case "get_page_context":
      return {
        content: parsePageContext(currentPath) || "无法确定当前页面上下文",
      };

    default:
      return null; // Not a navigation tool
  }
}

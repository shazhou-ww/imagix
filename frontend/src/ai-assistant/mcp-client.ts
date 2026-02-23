// ---------------------------------------------------------------------------
// AI Assistant – Lightweight MCP Streamable HTTP client
//
// Implements JSON-RPC over HTTP to talk to the backend MCP endpoint.
// Reuses the existing Cognito ID token for authentication.
// ---------------------------------------------------------------------------

import { fetchAuthSession } from "aws-amplify/auth";
import type { ToolDefinition, ToolResult } from "./types";

const MCP_ENDPOINT = "/mcp";

/** JSON-RPC 2.0 request envelope */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response envelope */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let requestId = 0;

async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

async function rpcCall(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const body: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: ++requestId,
    method,
    params,
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MCP request failed: ${res.status} ${res.statusText}`);
  }

  const json: JsonRpcResponse = await res.json();

  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the MCP connection. Must be called once before other methods.
 * Sends the `initialize` handshake.
 */
export async function mcpInitialize(): Promise<void> {
  await rpcCall("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "imagix-ai-assistant", version: "1.0.0" },
  });

  // Send initialized notification (no id, but our stateless server doesn't
  // need it — we simply ignore errors here)
  const token = await getAuthToken();
  if (token) {
    await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    }).catch(() => {});
  }
}

/**
 * List all available MCP tools from the server.
 */
export async function mcpListTools(): Promise<ToolDefinition[]> {
  // The server is stateless — each request creates a fresh server.
  // We need to initialize + list tools in the same request? No — the MCP
  // stateless transport handles each request independently. We just call
  // tools/list and the server creates a new instance + registers all tools.
  //
  // Actually, with stateless transport, every POST creates a fresh Server.
  // So we must initialize first, then list tools in a separate request.
  // But since each request is independent, the server on the second request
  // has no memory of the first initialize. Let's try direct tools/list.
  //
  // Looking at the MCP SDK source, the stateless transport handles this:
  // - Each request gets its own Server instance
  // - The Server auto-initializes when processing any method
  // So we can just call tools/list directly.

  try {
    const result = (await rpcCall("tools/list", {})) as {
      tools: ToolDefinition[];
    };
    console.log('[MCP] tools/list returned', result.tools?.length, 'tools');
    return result.tools;
  } catch (e) {
    console.error('[MCP] tools/list failed:', e);
    throw e;
  }
}

/**
 * Call a specific MCP tool.
 */
export async function mcpCallTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const result = (await rpcCall("tools/call", { name, arguments: args })) as {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };

  // Collapse content array into a single string
  const text = result.content.map((c) => c.text).join("\n");
  return { content: text, isError: result.isError };
}

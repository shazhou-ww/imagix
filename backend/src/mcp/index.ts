/**
 * MCP Hono route adapter — stateless Streamable HTTP for Lambda / Bun dev server.
 *
 * Each POST request creates a fresh Server + Transport pair, handles the
 * JSON-RPC message, and returns. No sessions are kept between requests.
 */
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AppEnv } from "../app.js";
import { auth } from "../app.js";
import { createMcpServer } from "./server.js";

const app = new Hono<AppEnv>();

// Apply auth middleware to all MCP routes
app.use("*", auth);

// Handle all MCP requests (POST for JSON-RPC, GET for SSE, DELETE for session)
app.all("/", async (c) => {
  // Create a stateless transport for each request (no session, JSON responses)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  const server = createMcpServer();

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(c.req.raw);
    return response;
  } finally {
    // Clean up server connection after response
    await server.close().catch(() => {});
  }
});

export default app;

/**
 * MCP Hono route adapter — stateless Streamable HTTP for Lambda / Bun dev server.
 *
 * Each POST request creates a fresh Server + Transport pair, handles the
 * JSON-RPC message, and returns. No sessions are kept between requests.
 *
 * OAuth: MCP clients authenticate via the OAuth flow defined in ./auth.ts.
 * The /oauth sub-routes handle registration, authorization, and token exchange.
 * The MCP endpoint itself requires a valid Bearer token.
 */
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AppEnv } from "../app.js";
import { createMcpServer } from "./server.js";
import { oauthRoutes, requireMcpAuth } from "./auth.js";

const app = new Hono<AppEnv>();

// OAuth endpoints (no auth required — they ARE the auth flow)
app.route("/oauth", oauthRoutes);

// MCP endpoint (requires Bearer token)
app.all("/", requireMcpAuth, async (c) => {
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

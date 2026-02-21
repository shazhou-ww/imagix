/**
 * MCP OAuth Authentication Layer
 *
 * Acts as an OAuth 2.1 Authorization Server that proxies to Cognito.
 * This is needed because Cognito doesn't support dynamic client registration
 * (RFC 7591) which MCP clients require.
 *
 * Flow:
 * 1. MCP client discovers AS metadata at /.well-known/oauth-authorization-server
 * 2. MCP client dynamically registers at /mcp/oauth/register (in-memory)
 * 3. MCP client redirects user to /mcp/oauth/authorize → Cognito Hosted UI
 * 4. User authenticates at Cognito (Google, etc.)
 * 5. Cognito redirects to /mcp/oauth/callback → MCP client callback
 * 6. MCP client exchanges code at /mcp/oauth/token → proxied to Cognito
 * 7. MCP client sends Bearer token on subsequent MCP requests
 *
 * Required env vars:
 *   COGNITO_USER_POOL_ID — Cognito User Pool ID
 *   COGNITO_CLIENT_ID    — Cognito App Client ID (for MCP)
 *   COGNITO_DOMAIN       — Cognito Hosted UI domain (e.g. imagix-auth-dev.auth.us-east-1.amazoncognito.com)
 */

import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppEnv } from "../app.js";

// ── Cognito configuration ────────────────────────────────────────────────────

function cognitoConfig() {
  return {
    userPoolId: process.env.COGNITO_USER_POOL_ID ?? process.env.IMAGIX_USER_POOL_ID ?? "",
    clientId: process.env.COGNITO_CLIENT_ID ?? process.env.IMAGIX_USER_POOL_CLIENT_ID ?? "",
    domain: process.env.COGNITO_DOMAIN ?? process.env.IMAGIX_COGNITO_DOMAIN ?? "",
  };
}

// ── In-memory stores (per process — stateless Lambda resets on cold start) ──

interface RegisteredClient {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
}

interface PendingAuth {
  mcpClientId: string;
  mcpRedirectUri: string;
  mcpState?: string;
  cognitoState: string;
}

const registeredClients = new Map<string, RegisteredClient>();
const pendingAuths = new Map<string, PendingAuth>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrigin(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

// ── Well-Known Metadata Routes ───────────────────────────────────────────────
// Mount at /.well-known in the main app

export const wellKnownRoutes = new Hono<AppEnv>();

// OAuth Protected Resource Metadata (RFC 9728)
const resourceMetadataHandler = (c: Context) => {
  const origin = getOrigin(c);
  return c.json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
  });
};

wellKnownRoutes.get("/oauth-protected-resource", resourceMetadataHandler);
wellKnownRoutes.get("/oauth-protected-resource/mcp", resourceMetadataHandler);

// OAuth Authorization Server Metadata (RFC 8414)
wellKnownRoutes.get("/oauth-authorization-server", (c) => {
  const origin = getOrigin(c);
  return c.json({
    issuer: origin,
    authorization_endpoint: `${origin}/mcp/oauth/authorize`,
    token_endpoint: `${origin}/mcp/oauth/token`,
    registration_endpoint: `${origin}/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["openid", "email", "profile"],
  });
});

// ── OAuth Proxy Routes ───────────────────────────────────────────────────────
// Mount at /mcp/oauth in the main app

export const oauthRoutes = new Hono<AppEnv>();

// Dynamic Client Registration (RFC 7591)
oauthRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  console.log("[MCP OAuth] POST /register", JSON.stringify(body));
  const clientId = `mcp_${crypto.randomUUID()}`;

  const client: RegisteredClient = {
    client_id: clientId,
    redirect_uris: body.redirect_uris ?? [],
    client_name: body.client_name,
    grant_types: body.grant_types ?? ["authorization_code"],
    response_types: body.response_types ?? ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };

  registeredClients.set(clientId, client);
  console.log(`[MCP OAuth] Registered client: ${clientId}`);

  return c.json(client, 201);
});

// Authorize — redirect to Cognito Hosted UI
oauthRoutes.get("/authorize", (c) => {
  const cfg = cognitoConfig();
  if (!cfg.domain || !cfg.clientId) {
    console.error("[MCP OAuth] Cognito not configured:", JSON.stringify(cfg));
    return c.json(
      { error: "server_error", error_description: "Cognito not configured" },
      500,
    );
  }

  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
  } = c.req.query();

  // Look up or auto-register client (in-memory store may be cleared by hot-reload)
  let client = registeredClients.get(client_id);
  if (!client) {
    if (!client_id || !redirect_uri) {
      return c.json(
        { error: "invalid_client", error_description: "Missing client_id or redirect_uri" },
        400,
      );
    }
    console.log(`[MCP OAuth] Auto-registering client ${client_id} with redirect_uri ${redirect_uri}`);
    client = {
      client_id,
      redirect_uris: [redirect_uri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    registeredClients.set(client_id, client);
  }

  // Generate internal state for Cognito ↔ MCP client mapping
  const cognitoState = crypto.randomUUID();
  pendingAuths.set(cognitoState, {
    mcpClientId: client_id,
    mcpRedirectUri: redirect_uri,
    mcpState: state,
    cognitoState,
  });

  // Build Cognito authorize URL
  const origin = getOrigin(c);
  const cognitoUrl = new URL(`https://${cfg.domain}/oauth2/authorize`);
  cognitoUrl.searchParams.set("response_type", "code");
  cognitoUrl.searchParams.set("client_id", cfg.clientId);
  cognitoUrl.searchParams.set(
    "redirect_uri",
    `${origin}/mcp/oauth/callback`,
  );
  cognitoUrl.searchParams.set("state", cognitoState);
  cognitoUrl.searchParams.set("scope", scope ?? "openid email profile");

  // Pass PKCE through to Cognito
  if (code_challenge) {
    cognitoUrl.searchParams.set("code_challenge", code_challenge);
    cognitoUrl.searchParams.set(
      "code_challenge_method",
      code_challenge_method ?? "S256",
    );
  }

  return c.redirect(cognitoUrl.toString());
});

// Callback from Cognito → redirect back to MCP client
oauthRoutes.get("/callback", (c) => {
  console.log("[MCP OAuth] GET /callback", { hasCode: !!c.req.query("code"), state: c.req.query("state"), error: c.req.query("error") });
  const { code, state, error, error_description } = c.req.query();

  if (!state) return c.text("Missing state parameter", 400);

  const pending = pendingAuths.get(state);
  if (!pending) return c.text("Invalid or expired state parameter", 400);
  pendingAuths.delete(state);

  const redirectUrl = new URL(pending.mcpRedirectUri);

  if (error) {
    redirectUrl.searchParams.set("error", error);
    if (error_description)
      redirectUrl.searchParams.set("error_description", error_description);
    if (pending.mcpState)
      redirectUrl.searchParams.set("state", pending.mcpState);
    return c.redirect(redirectUrl.toString());
  }

  // Pass the Cognito auth code back to the MCP client
  redirectUrl.searchParams.set("code", code);
  if (pending.mcpState)
    redirectUrl.searchParams.set("state", pending.mcpState);
  return c.redirect(redirectUrl.toString());
});

// Token exchange — proxy to Cognito
oauthRoutes.post("/token", async (c) => {
  console.log("[MCP OAuth] POST /token");
  const cfg = cognitoConfig();
  if (!cfg.domain || !cfg.clientId) {
    return c.json(
      { error: "server_error", error_description: "Cognito not configured" },
      500,
    );
  }

  const body = await c.req.parseBody();
  const origin = getOrigin(c);

  // Build Cognito token request
  const cognitoBody = new URLSearchParams();
  cognitoBody.set("grant_type", body.grant_type as string);
  cognitoBody.set("client_id", cfg.clientId);

  if (body.grant_type === "authorization_code") {
    cognitoBody.set("code", body.code as string);
    // Must match the redirect_uri sent in /authorize to Cognito
    cognitoBody.set("redirect_uri", `${origin}/mcp/oauth/callback`);
    if (body.code_verifier) {
      cognitoBody.set("code_verifier", body.code_verifier as string);
    }
  } else if (body.grant_type === "refresh_token") {
    cognitoBody.set("refresh_token", body.refresh_token as string);
  }

  const cognitoRes = await fetch(`https://${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cognitoBody,
  });

  const result = await cognitoRes.json();
  return c.json(result as Record<string, unknown>, cognitoRes.status as any);
});

// ── MCP Auth Middleware ──────────────────────────────────────────────────────
// Requires a valid Bearer token; returns 401 with discovery hints if missing

export const requireMcpAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header =
    c.req.header("authorization") ?? c.req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    const origin = getOrigin(c);
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    );
    return c.json({ error: "unauthorized" }, 401);
  }

  try {
    const token = header.slice(7);
    const payload = token.split(".")[1];
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    );
    const userId = claims?.sub;

    if (!userId) {
      c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
      return c.json({ error: "invalid_token" }, 401);
    }

    c.set("userId", userId);
    await next();
  } catch {
    c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
    return c.json({ error: "invalid_token" }, 401);
  }
});

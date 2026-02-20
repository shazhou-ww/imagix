import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { AppError } from "./controllers/errors.js";

export type AppEnv = {
  Bindings: {
    event: APIGatewayProxyEvent;
    lambdaContext: unknown;
  };
  Variables: {
    userId: string;
  };
};

export const auth = createMiddleware<AppEnv>(async (c, next) => {
  // Try API Gateway authorizer claims first (v1 or v2),
  // then fall back to decoding the JWT from the Authorization header.
  const authorizer = (c.env.event?.requestContext as any)?.authorizer;
  let claims = authorizer?.jwt?.claims ?? authorizer?.claims;

  if (!claims?.sub) {
    // No API Gateway authorizer — decode JWT from Authorization header
    const header = c.req.header("authorization") ?? c.req.header("Authorization");
    if (header?.startsWith("Bearer ")) {
      try {
        const token = header.slice(7);
        const payload = token.split(".")[1];
        claims = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf-8"),
        );
      } catch {
        // Invalid token, fall through to anonymous
      }
    }
  }

  const userId = claims?.sub ?? "anonymous";
  c.set("userId", userId);
  await next();
});

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", cors());

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

/** Extract a required path parameter, throwing 400 if missing. */
export function p(c: Context, name: string): string {
  const val = c.req.param(name);
  if (!val) throw AppError.badRequest(`Missing path parameter: ${name}`);
  return val;
}

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
  const claims = (c.env.event?.requestContext as any)?.authorizer?.claims;
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

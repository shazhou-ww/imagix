import { describe, expect, it } from "vitest";
import { handler } from "./index";

describe("handler", () => {
  it("returns 200 for health check", async () => {
    const event = {
      httpMethod: "GET",
      path: "/api/health",
      body: null,
      headers: {},
      isBase64Encoded: false,
      requestContext: {},
      resource: "",
    };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await handler(event as any);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ status: "ok" });
  });
});

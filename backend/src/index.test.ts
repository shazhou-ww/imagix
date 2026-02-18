import { describe, expect, it } from "vitest";
import { handler } from "./index";

describe("handler", () => {
  it("returns 200 for health check", async () => {
    const result = await handler({
      httpMethod: "GET",
      path: "/api/health",
      body: null,
      headers: {},
      isBase64Encoded: false,
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      pathParameters: null,
      queryStringParameters: null,
      requestContext: {} as never,
      resource: "",
      stageVariables: null,
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).status).toBe("ok");
  });
});

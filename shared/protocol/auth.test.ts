import { describe, expect, it } from "vitest";
import { LoginRequestSchema, LoginResponseSchema } from "./auth";

describe("auth protocol", () => {
  it("parses valid login request", () => {
    const result = LoginRequestSchema.safeParse({
      provider: "google",
      token: "some-google-token",
    });
    expect(result.success).toBe(true);
  });

  it("parses valid login response", () => {
    const result = LoginResponseSchema.safeParse({
      success: true,
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      },
    });
    expect(result.success).toBe(true);
  });
});

import { jsonResult, type ToolRegistry } from "../registry.js";

export function registerUserTools(registry: ToolRegistry) {
  registry.register({
    name: "get_current_user",
    description:
      "Get the current authenticated user's ID. In local dev mode this returns 'local-dev'.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, ctx) => jsonResult({ userId: ctx.userId }),
  });
}

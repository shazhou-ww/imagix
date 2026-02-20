import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    env: {
      DYNAMODB_ENDPOINT: "http://127.0.0.1:4512",
      TABLE_NAME: "imagix",
    },
  },
});

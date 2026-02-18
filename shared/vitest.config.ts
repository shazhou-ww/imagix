import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@imagix/shared": resolve(__dirname, "./src/index.ts"),
    },
  },
});

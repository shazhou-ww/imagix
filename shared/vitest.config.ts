import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

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

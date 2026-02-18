import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  envPrefix: "IMAGIX_",
  envDir: resolve(__dirname, ".."),
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => `/prod${path}`,
      },
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
  },
});

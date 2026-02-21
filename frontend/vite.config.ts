import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
    port: 4510,
    proxy: {
      "/api": {
        target: process.env.IMAGIX_API_URL || "http://127.0.0.1:4511",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
  },
});

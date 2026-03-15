import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || "http://localhost:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": {
          target: devProxyTarget,
          changeOrigin: true,
        },
        "/admin": {
          target: devProxyTarget,
          changeOrigin: true,
        },
        "/media": {
          target: devProxyTarget,
          changeOrigin: true,
        },
        "/static": {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            mui: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
            forms: ["react-hook-form", "@hookform/resolvers", "zod"],
            query: ["@tanstack/react-query"],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      fileParallelism: false,
      globals: true,
      setupFiles: "./src/test/setup.ts",
    },
  };
});

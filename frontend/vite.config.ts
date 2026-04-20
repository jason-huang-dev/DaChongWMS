import { fileURLToPath, URL } from "node:url";

import JavaScriptObfuscator from "javascript-obfuscator";
import react from "@vitejs/plugin-react";
import type { PluginOption } from "vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const vendorChunkNames = new Set(["react", "mui", "forms", "query"]);

function buildObfuscationPlugin(enabled: boolean): PluginOption {
  if (!enabled) {
    return null;
  }

  return {
    name: "app-bundle-obfuscator",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || vendorChunkNames.has(chunk.name)) {
          continue;
        }

        chunk.code = JavaScriptObfuscator.obfuscate(chunk.code, {
          compact: true,
          identifierNamesGenerator: "hexadecimal",
          ignoreImports: true,
          renameGlobals: false,
          renameProperties: false,
          selfDefending: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 8,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayCallsTransformThreshold: 0.75,
          stringArrayEncoding: ["base64"],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayThreshold: 0.75,
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
        }).getObfuscatedCode();
        chunk.map = null;
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || "http://localhost:8000";
  const shouldObfuscate = mode === "production" && !["0", "false"].includes((env.BUILD_OBFUSCATE || "").toLowerCase());

  return {
    plugins: [react(), buildObfuscationPlugin(shouldObfuscate)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    optimizeDeps: {
      entries: [
        "src/**/*.ts",
        "src/**/*.tsx",
        "!src/**/*.test.ts",
        "!src/**/*.test.tsx",
        "!src/**/*.spec.ts",
        "!src/**/*.spec.tsx",
      ],
      force: true,
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
        "/health": {
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

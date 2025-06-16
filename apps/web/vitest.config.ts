import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 180000, // 3 minutes timeout for all tests
    hookTimeout: 180000, // 3 minutes timeout for hooks
    server: {
      deps: {
        inline: [/@next-eval/],
      },
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@next-eval/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "/next-eval/rust_mdr_pkg": path.resolve(
        __dirname,
        "./public/rust_mdr_pkg",
      ),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});

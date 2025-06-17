import path from "node:path";
import ms from "ms";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: ms("3min"),
    hookTimeout: ms("3min"),
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

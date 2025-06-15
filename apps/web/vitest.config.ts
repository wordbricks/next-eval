import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
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

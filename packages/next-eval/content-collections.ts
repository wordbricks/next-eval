import { defineCollection, defineConfig } from "@content-collections/core";
import { findUpSync } from "find-up";
import { z } from "zod";

const projectRootFindupFile = findUpSync("bun.lock", { cwd: process.cwd() });

if (!projectRootFindupFile)
  throw new Error("Could not find project root (package.json)");

const prompts = defineCollection({
  name: "prompts",
  directory: "./src/llm/prompts",
  include: "*.md",
  exclude: "README.md",
  schema: z.object({}),
});

export default defineConfig({
  collections: [prompts],
});

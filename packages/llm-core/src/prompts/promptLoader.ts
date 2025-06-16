import fs from "node:fs/promises";
import path from "node:path";
import type { PromptType } from "@next-eval/shared/interfaces/types";

export const loadPromptContent = async (
  promptType: PromptType,
): Promise<string> => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "prompts",
    `system-llm-${promptType}.md`,
  );
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load prompt file for ${promptType}:`, error);
    throw new Error(`Prompt file for ${promptType} not found`);
  }
};

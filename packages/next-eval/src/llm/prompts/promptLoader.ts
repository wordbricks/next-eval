import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptType } from "@wordbricks/next-eval/shared/interfaces/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadPromptContent = async (
  promptType: PromptType,
): Promise<string> => {
  const filePath = path.join(__dirname, `system-llm-${promptType}.md`);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load prompt file for ${promptType}:`, error);
    throw new Error(`Prompt file for ${promptType} not found`);
  }
};

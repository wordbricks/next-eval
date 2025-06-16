import { google } from "@ai-sdk/google";
import { GEMINI_PRO_2_5_PREVIEW_03 } from "@next-eval/llm-core/constants";
import { loadPromptContent } from "@next-eval/llm-core/prompts/promptLoader";
import type { LLMUsage } from "@next-eval/shared/interfaces/LLMResponse";
import type { PromptType } from "@next-eval/shared/interfaces/types";
import { generateText } from "ai";

export const getLLMResponse = async (
  data: string,
  promptType: PromptType,
  temperature = 1.0,
): Promise<{
  text: string;
  usage: LLMUsage;
}> => {
  const systemPromptContent = await loadPromptContent(promptType);
  const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${data}`;
  const { text, usage } = await generateText({
    model: google(GEMINI_PRO_2_5_PREVIEW_03),
    prompt: combinedPrompt,
    temperature: temperature,
  });
  return { text, usage };
};

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { LLMUsage } from "../../shared/interfaces/LLMResponse";
import type { PromptType } from "../../shared/interfaces/types";
import { GEMINI_PRO_2_5_PREVIEW_03 } from "../constants";
import { getPrompt } from "../prompts/getPrompt";

export const getLLMResponse = async (
  data: string,
  promptType: PromptType,
  temperature = 1.0,
): Promise<{
  text: string;
  usage: LLMUsage;
}> => {
  const systemPromptContent = getPrompt(`system-llm-${promptType}`);
  const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${data}`;
  const { text, usage } = await generateText({
    model: google(GEMINI_PRO_2_5_PREVIEW_03),
    prompt: combinedPrompt,
    temperature: temperature,
  });
  return { text, usage };
};

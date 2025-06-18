import { compile } from "../llm/utils/compile";
import type { LLMUsage } from "../shared/interfaces/LLMResponse";
import type { PromptType } from "../shared/interfaces/types";

// Note: getLLMResponse is only available in server environments
// It will be imported dynamically to avoid bundling issues
type GetLLMResponseFn = (
  data: string,
  promptType: PromptType,
  temperature?: number,
) => Promise<{
  text: string;
  usage: LLMUsage;
}>;

export interface LLMProcessor {
  getLLMResponse: GetLLMResponseFn;
  compile: (prompt: string, data: any) => string;
}

export interface LLMProcessorOptions {
  temperature?: number;
}

// Server-side only processor
export const createLLMProcessor = async (
  options?: LLMProcessorOptions,
): Promise<LLMProcessor> => {
  // Dynamic import to ensure this only runs on server
  const { getLLMResponse } = await import("../llm/utils/getLLMResponse");

  const defaultTemperature = options?.temperature ?? 1.0;

  return {
    getLLMResponse: (
      data: string,
      promptType: PromptType,
      temperature?: number,
    ) => getLLMResponse(data, promptType, temperature ?? defaultTemperature),

    compile: (prompt: string, data: any) => compile(prompt, data),
  };
};

// Client-safe processor without getLLMResponse
export interface ClientLLMProcessor {
  compile: (prompt: string, data: any) => string;
}

export const createClientLLMProcessor = (): ClientLLMProcessor => {
  return {
    compile: (prompt: string, data: any) => compile(prompt, data),
  };
};

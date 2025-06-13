export interface LLMResponse {
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  systemPromptUsed?: string;
}

export type PromptType = "slim" | "flat" | "hier";

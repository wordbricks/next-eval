export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content?: string;
  role?: string;
  error?: string;
  usage?: LLMUsage;
  systemPromptUsed?: string;
}

export interface LLMResponseWithError
  extends Omit<LLMResponse, "content" | "role"> {
  content?: string;
  error?: string;
  systemPromptUsed?: string;
}

export interface LLMUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface LLMResponse {
	content: string;
	role: string;
	usage?: LLMUsage;
}
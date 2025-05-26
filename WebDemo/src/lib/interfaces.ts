export type NestedTextMap = string | { [key: string]: NestedTextMap };

export interface HtmlResult {
  html: string;
  htmlLength: number;
  textMap: NestedTextMap;
  textMapLength: number;
  textMapFlat: Record<string, string>;
  textMapFlatLength: number;
  originalHtml: string;
  originalHtmlLength?: number; // Optional as it might not always be available or relevant
  rawHtml?: string; // Added to store the original, unprocessed HTML
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content?: string;
  usage?: LLMUsage;
  error?: string;
  systemPromptUsed?: string;
}

export interface EvaluationResult {
  precision: number;
  recall: number;
  f1: number;
  totalOverlap: number;
  matches: number;
  validPredictedRecords: number;
  totalPredictedRecords: number;
}

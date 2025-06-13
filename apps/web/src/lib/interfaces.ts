// Import base interfaces from shared package
import type {
  EvaluationResult as BaseEvaluationResult,
  HtmlResult as BaseHtmlResult,
  LLMResponse as BaseLLMResponse,
  LLMUsage as SharedLLMUsage,
  NestedTextMap as SharedNestedTextMap,
  TagNode as SharedTagNode,
} from "@next-eval/shared/interfaces";

// Export the types that are used elsewhere
export type NestedTextMap = SharedNestedTextMap;
export type LLMUsage = SharedLLMUsage;
export type TagNode = SharedTagNode;

export interface HtmlResult extends BaseHtmlResult {
  htmlLength: number;
  textMapLength: number;
  textMapFlatLength: number;
  originalHtml: string;
  originalHtmlLength?: number;
  rawHtml?: string;
}

export interface LLMResponse extends Omit<BaseLLMResponse, "content" | "role"> {
  content?: string;
  error?: string;
  systemPromptUsed?: string;
}

export interface EvaluationResult extends BaseEvaluationResult {
  validPredictedRecords: number;
  totalPredictedRecords: number;
}

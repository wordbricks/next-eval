// Re-export base interfaces from shared package
export {
  NestedTextMap,
  HtmlResult as BaseHtmlResult,
  LLMUsage,
  LLMResponse as BaseLLMResponse,
  EvaluationResult as BaseEvaluationResult,
  TagNode,
} from "@next-eval/shared";

// Extend interfaces for web app specific needs
import type {
  HtmlResult as BaseHtmlResult,
  LLMResponse as BaseLLMResponse,
  EvaluationResult as BaseEvaluationResult,
} from "@next-eval/shared";

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

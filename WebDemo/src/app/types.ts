import type { ValidatedXpathArray } from '../lib/utils/xpathValidation';

export interface LlmStageResponse {
  content: string | null;
  usage: string | null;
  error: string | null;
  predictXpathList: ValidatedXpathArray | null;
  numPredictedRecords: number | null;
  numHallucination: number | null;
  mappedPredictionText: string[];
  isLoading: boolean;
  isEvaluating: boolean;
}

export interface MdrResponseState {
  predictXpathList: ValidatedXpathArray | null;
  mappedPredictionText: string[] | null;
  numPredictedRecords: number | null;
  isLoading: boolean;
  error: string | null;
}

export interface LlmAllResponses {
  html: LlmStageResponse;
  textMap: LlmStageResponse;
  textMapFlat: LlmStageResponse;
}

export type ExtractTab = 'llm' | 'mdr';

export const initialLlmStageResponse: LlmStageResponse = {
  content: null,
  usage: null,
  error: null,
  predictXpathList: null,
  numPredictedRecords: null,
  numHallucination: null,
  mappedPredictionText: null,
  isLoading: false,
  isEvaluating: false,
};

export const initialMdrResponseState: MdrResponseState = {
  predictXpathList: null,
  mappedPredictionText: null,
  numPredictedRecords: null,
  isLoading: false,
  error: null,
};
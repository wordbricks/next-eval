import type { ValidatedXpathArray } from "@/app/utils/xpathValidation";
import { atom } from "jotai";

export interface LlmStageResponse {
  content: string | null;
  usage: string | null;
  error: string | null;
  predictXpathList: ValidatedXpathArray | null;
  numPredictedRecords: number | null;
  numHallucination: number | null;
  mappedPredictionText: string[] | null;
  isLoading: boolean;
  isEvaluating: boolean;
}

export interface LlmAllResponses {
  html: LlmStageResponse;
  textMap: LlmStageResponse;
  textMapFlat: LlmStageResponse;
}

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

export const llmResponsesAtom = atom<LlmAllResponses>({
  html: { ...initialLlmStageResponse },
  textMap: { ...initialLlmStageResponse },
  textMapFlat: { ...initialLlmStageResponse },
});

export const overallLlmFetchingAtom = atom<boolean>(false);

export const selectedStageAtom = atom<keyof LlmAllResponses>("textMapFlat");

export const selectedLlmModelAtom = atom<string>("gemini-2.5-pro");

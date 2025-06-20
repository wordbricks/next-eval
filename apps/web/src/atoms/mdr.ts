import type { ValidatedXpathArray } from "@/app/utils/xpathValidation";
import { atom } from "jotai";

export interface MdrState {
  predictXpathList: ValidatedXpathArray | null;
  mappedPredictionText: string[] | null;
  numPredictedRecords: number | null;
}

// Simple atom definitions
export const mdrResponseAtom = atom<MdrState>({
  predictXpathList: null,
  mappedPredictionText: null,
  numPredictedRecords: null,
});

export const mdrLoadingAtom = atom<boolean>(false);

export const mdrErrorAtom = atom<string | null>(null);

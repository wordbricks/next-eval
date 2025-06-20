import type { ExtendedHtmlResult } from "@wordbricks/next-eval";
import { atom } from "jotai";

export const processedDataAtom = atom<ExtendedHtmlResult | null>(null);

export const randomNumberAtom = atom<number | null>(null);

export const htmlIdAtom = atom<string | null>(null);

export const feedbackSentAtom = atom<{ [key: string]: boolean }>({});

export const activeExtractTabAtom = atom<"llm" | "mdr">("llm");

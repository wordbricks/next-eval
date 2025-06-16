import type { ValidatedXpathArray } from "@/app/utils/xpathValidation";
import {
  mdrErrorAtom,
  mdrLoadingAtom,
  mdrProgressAtom,
  mdrResponseAtom,
} from "@/atoms/mdr";
import { runMDR } from "@/lib/utils/runMDR";
import { mapResponseToFullXpath } from "@wordbricks/next-eval/evaluation/utils/mapResponseToFullXpath";
import type { ExtendedHtmlResult } from "@wordbricks/next-eval/shared/interfaces/HtmlResult";
import { useAtom } from "jotai";
import { useCallback } from "react";

// Helper function for timeout
const timeoutPromise = <T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error("Operation timed out"),
) => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(timeoutError);
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export const useMdr = () => {
  const [mdrResponse, setMdrResponse] = useAtom(mdrResponseAtom);
  const [progress, setProgress] = useAtom(mdrProgressAtom);
  const [isLoading, setIsLoading] = useAtom(mdrLoadingAtom);
  const [error, setError] = useAtom(mdrErrorAtom);

  const resetMdr = useCallback(() => {
    setMdrResponse({
      predictXpathList: null,
      mappedPredictionText: null,
      numPredictedRecords: null,
    });
    setProgress(0);
    setIsLoading(false);
    setError(null);
  }, [setMdrResponse, setProgress, setIsLoading, setError]);

  const runMdrAlgorithm = useCallback(
    async (processedData: ExtendedHtmlResult | null) => {
      if (!processedData?.originalHtml || !processedData.textMapFlat) {
        console.error(
          "Original HTML or textMapFlat not available for MDR execution.",
        );
        setError(
          "Required data (original HTML or text map) is not processed yet.",
        );
        return;
      }

      resetMdr();
      setIsLoading(true);

      try {
        // Progress callback to update the progress bar
        const progressCallback = (progressValue: number) => {
          setProgress(progressValue);
        };

        // Run MDR with timeout
        const mdrPromise = runMDR(processedData.html, progressCallback);
        const mdrPredictedXPaths = await timeoutPromise(
          mdrPromise,
          60000, // 1 minute
          new Error("MDR processing timed out after 1 minute"),
        );

        if (!mdrPredictedXPaths || mdrPredictedXPaths.length === 0) {
          setMdrResponse({
            predictXpathList: [],
            mappedPredictionText: [],
            numPredictedRecords: 0,
          });
          setError("MDR returned no XPaths.");
          return;
        }

        // Validate XPaths
        const validatedMdrXPaths: ValidatedXpathArray =
          mdrPredictedXPaths as ValidatedXpathArray;
        const textMapFlatForEval = processedData.textMapFlat as Record<
          string,
          string
        >;
        const mdrFullXPaths = mapResponseToFullXpath(
          textMapFlatForEval,
          validatedMdrXPaths,
        );

        const mappedText = mdrFullXPaths
          .filter((xpathArray: string[]) =>
            xpathArray.some((xpath: string) => xpath in textMapFlatForEval),
          )
          .map((xpathArray: string[]) =>
            xpathArray
              .filter((xpath: string) => xpath in textMapFlatForEval)
              .map((xpath: string) => textMapFlatForEval[xpath])
              .join(","),
          );

        setMdrResponse({
          predictXpathList: validatedMdrXPaths,
          mappedPredictionText: mappedText,
          numPredictedRecords: validatedMdrXPaths.length,
        });
        setProgress(100);
      } catch (err) {
        console.error("Error running MDR:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [resetMdr, setMdrResponse, setProgress, setIsLoading, setError],
  );

  return {
    mdrResponse,
    progress,
    isLoading,
    error,
    runMdrAlgorithm,
    resetMdr,
  };
};

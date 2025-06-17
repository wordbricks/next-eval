import type { ValidatedXpathArray } from "@/app/utils/xpathValidation";
import { mdrErrorAtom, mdrLoadingAtom, mdrResponseAtom } from "@/atoms/mdr";
import { processedDataAtom } from "@/atoms/shared";
import { runMDR } from "@/lib/utils/runMDR";
import { wait } from "@/utils/wait";
import { mapResponseToFullXpath } from "@wordbricks/next-eval";
import { useAtom, useAtomValue } from "jotai";
import ms from "ms";
import { useCallback } from "react";

export const useMdr = () => {
  const [mdrResponse, setMdrResponse] = useAtom(mdrResponseAtom);
  const [isLoading, setIsLoading] = useAtom(mdrLoadingAtom);
  const [error, setError] = useAtom(mdrErrorAtom);
  const processedData = useAtomValue(processedDataAtom);

  const runMdrAlgorithm = useCallback(async () => {
    if (!processedData?.originalHtml || !processedData.textMapFlat) {
      console.error(
        "Original HTML or textMapFlat not available for MDR execution.",
      );
      setError(
        "Required data (original HTML or text map) is not processed yet.",
      );
      return;
    }

    setMdrResponse({
      predictXpathList: null,
      mappedPredictionText: null,
      numPredictedRecords: null,
    });
    setError(null);
    setIsLoading(true);

    try {
      const mdrPromise = runMDR(processedData.html);
      const mdrPredictedXPaths = await Promise.race([
        mdrPromise,
        wait(ms("1m")).then(() => {
          throw new Error("MDR processing timed out after 1 minute");
        }),
      ]);

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
      const textMapFlatForEval = processedData.textMapFlat;
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
    } catch (err) {
      console.error("Error running MDR:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [setMdrResponse, setIsLoading, setError, processedData]);

  return {
    mdrResponse,
    isLoading,
    error,
    runMdrAlgorithm,
  };
};

import { parseAndValidateXPaths } from "@/app/utils/xpathValidation";
import {
  type LlmAllResponses,
  initialLlmStageResponse,
  llmResponsesAtom,
  overallLlmFetchingAtom,
  selectedLlmModelAtom,
  selectedStageAtom,
} from "@/atoms/llm";
import { processedDataAtom, randomNumberAtom } from "@/atoms/shared";
import { mapResponseToFullXpath } from "@wordbricks/next-eval";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";

export const useLlm = () => {
  const [llmResponses, setLlmResponses] = useAtom(llmResponsesAtom);
  const [overallLlmFetching, setOverallLlmFetching] = useAtom(
    overallLlmFetchingAtom,
  );
  const [selectedStage, setSelectedStage] = useAtom(selectedStageAtom);
  const [selectedLlmModel, setSelectedLlmModel] = useAtom(selectedLlmModelAtom);
  const processedData = useAtomValue(processedDataAtom);
  const randomNumber = useAtomValue(randomNumberAtom);

  const resetLlm = useCallback(() => {
    setLlmResponses({
      html: { ...initialLlmStageResponse },
      textMap: { ...initialLlmStageResponse },
      textMapFlat: { ...initialLlmStageResponse },
    });
    setOverallLlmFetching(false);
    setSelectedStage("textMapFlat");
  }, [setLlmResponses, setOverallLlmFetching, setSelectedStage]);

  const sendToLlm = useCallback(async () => {
    if (!processedData) {
      console.error("Processed data not available for LLM request.");
      return;
    }
    if (!selectedStage) {
      console.error("No stage selected for LLM request.");
      return;
    }

    setOverallLlmFetching(true);
    setLlmResponses((prev) => ({
      ...prev,
      [selectedStage]: { ...initialLlmStageResponse, isLoading: true },
    }));

    const stageKey = selectedStage;
    let stageDataForLlm: string | Record<string, unknown> | undefined;
    let promptTypeForLlm: string | undefined;

    if (stageKey === "html") {
      stageDataForLlm = processedData.html;
      promptTypeForLlm = "slim";
    } else if (stageKey === "textMap") {
      stageDataForLlm = processedData.textMap;
      promptTypeForLlm = "hier";
    } else if (stageKey === "textMapFlat") {
      stageDataForLlm = processedData.textMapFlat;
      promptTypeForLlm = "flat";
    } else {
      console.error(`Unknown stage key: ${stageKey} for LLM request.`);
      setOverallLlmFetching(false);
      setLlmResponses((prev) => ({
        ...prev,
        [stageKey]: {
          ...initialLlmStageResponse,
          error: "Unknown stage selected",
          isLoading: false,
        },
      }));
      return;
    }

    try {
      const requestBody = {
        promptType: promptTypeForLlm,
        data: JSON.stringify(stageDataForLlm, null, 2),
        randomNumber,
      };

      const response = await fetch("/next-eval/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `LLM API request for ${stageKey} failed with status ${response.status} and could not parse error.`,
        }));
        throw new Error(
          errorData.message ||
            `LLM API request for ${stageKey} failed with status ${response.status}`,
        );
      }

      const result = await response.json();
      if ("content" in result && "usage" in result) {
        const validatedPredXPaths = parseAndValidateXPaths(result.content);
        setLlmResponses((prev) => ({
          ...prev,
          [stageKey]: {
            ...initialLlmStageResponse,
            content: result.content,
            usage: result.usage,
            predictXpathList: validatedPredXPaths,
            error: null,
            isLoading: false,
            isEvaluating: false,
          },
        }));
      } else {
        throw new Error(
          `Unexpected response structure for ${stageKey}: ${JSON.stringify(result, null, 2)}`,
        );
      }
    } catch (error) {
      console.error(`Error sending to LLM for stage ${stageKey}:`, error);
      setLlmResponses((prev) => ({
        ...prev,
        [stageKey]: {
          ...initialLlmStageResponse,
          error: error instanceof Error ? error.message : String(error),
          content: null,
          usage: null,
          predictXpathList: null,
          isLoading: false,
          isEvaluating: false,
        },
      }));
    } finally {
      setOverallLlmFetching(false);
    }
  }, [
    selectedStage,
    setLlmResponses,
    setOverallLlmFetching,
    processedData,
    randomNumber,
  ]);

  const evaluateLlmResponses = useCallback(() => {
    if (!processedData?.textMapFlat) {
      setLlmResponses((prev) => {
        let needsUpdate = false;
        const newResponses = { ...prev };
        for (const stageKey of Object.keys(newResponses) as Array<
          keyof LlmAllResponses
        >) {
          if (
            newResponses[stageKey].numPredictedRecords !== null ||
            newResponses[stageKey].numHallucination !== null ||
            newResponses[stageKey].isEvaluating
          ) {
            needsUpdate = true;
            newResponses[stageKey] = {
              ...newResponses[stageKey],
              numPredictedRecords: null,
              numHallucination: null,
              mappedPredictionText: null,
              isEvaluating: false,
            };
          }
        }
        return needsUpdate ? newResponses : prev;
      });
      return;
    }

    const textMapFlatForEval = processedData.textMapFlat as Record<
      string,
      string
    >;
    let updateScheduled = false;

    setLlmResponses((prevResponses) => {
      const newResponses = { ...prevResponses };

      for (const stageKey of Object.keys(newResponses) as Array<
        keyof LlmAllResponses
      >) {
        const stageData = newResponses[stageKey];

        if (
          stageData.predictXpathList &&
          !stageData.isLoading &&
          !stageData.isEvaluating &&
          stageData.numPredictedRecords === null
        ) {
          newResponses[stageKey] = {
            ...stageData,
            isEvaluating: true,
            error: stageData.error?.includes("Evaluation Error:")
              ? stageData.error
                  .split("\n")
                  .filter((line) => !line.startsWith("Evaluation Error:"))
                  .join("\n") || null
              : stageData.error,
          };
          updateScheduled = true;
        } else if (stageData.isEvaluating && !stageData.isLoading) {
          try {
            if (!stageData.predictXpathList) {
              newResponses[stageKey] = {
                ...stageData,
                isEvaluating: false,
                numPredictedRecords: null,
                numHallucination: null,
                mappedPredictionText: null,
                error: `${stageData.error ? `${stageData.error}\n` : ""}Evaluation Error: XPaths disappeared during evaluation. Resetting metrics.`,
              };
              updateScheduled = true;
              continue;
            }

            const localNumPredictedRecords = stageData.predictXpathList.length;
            const mappedPredRecords = mapResponseToFullXpath(
              textMapFlatForEval,
              stageData.predictXpathList,
            );

            const mappedPredRecordsText = mappedPredRecords.map(
              (xpathArray: string[]) =>
                xpathArray
                  .map((xpath: string) => textMapFlatForEval[xpath])
                  .join(", "),
            );

            let localNumHallucination = 0;
            for (const record of mappedPredRecords) {
              if (record.length === 0) {
                localNumHallucination += 1;
              }
            }
            newResponses[stageKey] = {
              ...stageData,
              numPredictedRecords: localNumPredictedRecords,
              numHallucination: localNumHallucination,
              mappedPredictionText: mappedPredRecordsText,
              isEvaluating: false,
            };
            updateScheduled = true;
          } catch (evalError) {
            console.error(
              `Error during evaluation for ${stageKey}:`,
              evalError,
            );
            newResponses[stageKey] = {
              ...stageData,
              error: `${stageData.error ? `${stageData.error}\n` : ""}Evaluation Error: ${evalError instanceof Error ? evalError.message : String(evalError)}`,
              numPredictedRecords: null,
              numHallucination: null,
              mappedPredictionText: null,
              isEvaluating: false,
            };
            updateScheduled = true;
          }
        } else if (
          !stageData.predictXpathList &&
          !stageData.isLoading &&
          !stageData.isEvaluating &&
          (stageData.numPredictedRecords !== null ||
            stageData.numHallucination !== null)
        ) {
          newResponses[stageKey] = {
            ...stageData,
            numPredictedRecords: null,
            numHallucination: null,
            mappedPredictionText: null,
            isEvaluating: false,
          };
          updateScheduled = true;
        }
      }

      return updateScheduled ? newResponses : prevResponses;
    });
  }, [setLlmResponses, processedData]);

  useEffect(() => {
    evaluateLlmResponses();
  }, [llmResponses, evaluateLlmResponses]);

  return {
    llmResponses,
    selectedStage,
    selectedLlmModel,
    overallLlmFetching,
    setSelectedStage,
    setSelectedLlmModel,
    sendToLlm,
    resetLlm,
    evaluateLlmResponses,
  };
};

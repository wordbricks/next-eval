"use client";

import { overallLlmFetchingAtom } from "@/atoms/llm";
import { processedDataAtom } from "@/atoms/shared";
import CopyIcon from "@/components/icons/CopyIcon";
import ThumbsDownIcon from "@/components/icons/ThumbsDownIcon";
import ThumbsUpIcon from "@/components/icons/ThumbsUpIcon";
import { useFeedback } from "@/hooks/useFeedback";
import { useMdr } from "@/hooks/useMdr";
import { Progress } from "@next-eval/ui/components/progress";
import { useAtomValue } from "jotai";
import { useState } from "react";

interface MdrTabProps {
  isProcessing: boolean;
}

export function MdrTab({ isProcessing }: MdrTabProps) {
  const { mdrResponse, progress, isLoading, error, runMdrAlgorithm } = useMdr();
  const { feedbackSent, handleFeedback, getCurrentFeedbackId } = useFeedback();
  const processedData = useAtomValue(processedDataAtom);
  const overallLlmFetching = useAtomValue(overallLlmFetchingAtom);
  const [copySuccess, setCopySuccess] = useState<string>("");

  // TODO use `useCopyToClipboard` hook
  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(""), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setCopySuccess("Failed to copy");
    }
  };

  return (
    <div className="mt-4">
      {/* Run MDR Button */}
      <div className="mb-6 flex items-center justify-center">
        <button
          type="button"
          onClick={() => runMdrAlgorithm()}
          aria-label="Run MDR Algorithm on Original HTML"
          className="w-full rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white shadow-md transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={
            !processedData?.originalHtml || isLoading || overallLlmFetching
          }
        >
          {isLoading ? "Running MDR..." : "Run MDR Algorithm"}
        </button>
      </div>
      {/* MDR Response Card */}
      {processedData && !isProcessing && (
        <div className="flex flex-col rounded-lg border bg-gray-50 p-4 shadow-xs">
          <h3 className="mb-3 border-b pb-2 font-semibold text-gray-800 text-lg">
            MDR Algorithm Response
          </h3>
          {isLoading && (
            <div className="space-y-3">
              <p className="animate-pulse font-medium text-blue-600 text-md">
                Processing with MDR, please wait...
              </p>
              <Progress value={progress} className="w-full" />
              <p className="text-center text-gray-600 text-sm">
                {progress}% complete
              </p>
            </div>
          )}
          {error && (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm"
              role="alert"
            >
              <p className="font-semibold">MDR Error:</p>
              <pre className="whitespace-pre-wrap break-all">{error}</pre>
            </div>
          )}
          {!isLoading && (mdrResponse.predictXpathList || error) && !error && (
            <>
              {mdrResponse.predictXpathList && (
                <div className="mb-3">
                  <h4 className="mb-1 font-semibold text-gray-600 text-sm">
                    Predicted XPaths:
                  </h4>
                  <div className="h-48 overflow-auto rounded-md border bg-gray-100 p-2 text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(mdrResponse.predictXpathList, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              {mdrResponse.mappedPredictionText &&
                mdrResponse.mappedPredictionText.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <h4 className="font-semibold text-gray-600 text-sm">
                        Predicted Text:
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFeedback(true, "mdr")}
                          disabled={feedbackSent[getCurrentFeedbackId("mdr")]}
                          className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-green-100 ${
                            feedbackSent[getCurrentFeedbackId("mdr")]
                              ? "text-green-600"
                              : "text-gray-400 hover:text-green-600"
                          }`}
                          aria-label="Give positive feedback"
                        >
                          <ThumbsUpIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(false, "mdr")}
                          disabled={feedbackSent[getCurrentFeedbackId("mdr")]}
                          className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-red-100 ${
                            feedbackSent[getCurrentFeedbackId("mdr")]
                              ? "text-red-600"
                              : "text-gray-400 hover:text-red-600"
                          }`}
                          aria-label="Give negative feedback"
                        >
                          <ThumbsDownIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyToClipboard(
                              mdrResponse.mappedPredictionText?.join("\n") ||
                                "",
                            )
                          }
                          className="group relative rounded-full p-1 text-orange-500 transition-colors duration-150 ease-in-out hover:bg-orange-100 hover:text-orange-700"
                          aria-label="Copy predicted text to clipboard"
                        >
                          <CopyIcon />
                          {copySuccess && (
                            <span className="-top-8 -translate-x-1/2 absolute left-1/2 transform rounded-sm bg-gray-800 px-2 py-1 text-white text-xs">
                              {copySuccess}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="h-40 overflow-auto rounded-md border bg-white p-2 text-xs">
                      {mdrResponse.mappedPredictionText.map(
                        (textBlock, index) => (
                          <pre
                            key={index}
                            className="my-1 whitespace-pre-wrap border-gray-200 border-b py-1 last:border-b-0"
                          >
                            {textBlock}
                          </pre>
                        ),
                      )}
                    </div>
                  </div>
                )}
              <div>
                <h4 className="mb-1 font-semibold text-gray-600 text-sm">
                  Evaluation Metrics:
                </h4>
                <div className="space-y-1 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs">
                  {mdrResponse.numPredictedRecords !== null && (
                    <p>
                      <span className="font-semibold">Predicted Records:</span>{" "}
                      {mdrResponse.numPredictedRecords}
                    </p>
                  )}
                  {mdrResponse.numPredictedRecords === 0 && (
                    <p className="text-gray-500">
                      MDR did not predict any records.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
          {!isLoading && !mdrResponse.predictXpathList && !error && (
            <p className="text-gray-500">Run MDR to see results.</p>
          )}
        </div>
      )}
    </div>
  );
}

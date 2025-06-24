"use client";

import type { LlmAllResponses } from "@/atoms/llm";
import CopyIcon from "@/components/icons/CopyIcon";
import ThumbsDownIcon from "@/components/icons/ThumbsDownIcon";
import ThumbsUpIcon from "@/components/icons/ThumbsUpIcon";
import { useFeedback } from "@/hooks/useFeedback";
import { useLlm } from "@/hooks/useLlm";
import { useEffect, useState } from "react";

interface LlmTabProps {
  isProcessing: boolean;
}

export function LlmTab({ isProcessing }: LlmTabProps) {
  const {
    llmResponses,
    selectedStage,
    selectedLlmModel,
    overallLlmFetching,
    setSelectedStage,
    setSelectedLlmModel,
    sendToLlm,
    resetLlm,
  } = useLlm();

  const { feedbackSent, handleFeedback, getCurrentFeedbackId } = useFeedback();
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

  const handleSendToLlm = () => {
    sendToLlm();
  };

  // Effect to reset when new file is selected
  useEffect(() => {
    if (isProcessing) {
      resetLlm();
    }
  }, [isProcessing, resetLlm]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 items-end gap-x-6 gap-y-4 md:grid-cols-2">
        {/* LLM Model Selection Dropdown */}
        <div>
          <label
            htmlFor="llmModelSelect"
            className="mb-1 block font-medium text-gray-700 text-sm"
          >
            LLM Model
          </label>
          <select
            id="llmModelSelect"
            name="llmModelSelect"
            value={selectedLlmModel}
            onChange={(e) => setSelectedLlmModel(e.target.value)}
            className="block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base shadow-xs focus:border-orange-500 focus:outline-hidden focus:ring-orange-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-sm"
          >
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="claude-3-opus-disabled" disabled>
              Claude 3 Opus (soon)
            </option>
            <option value="gpt4-turbo-disabled" disabled>
              GPT-4 Turbo (soon)
            </option>
          </select>
        </div>
        {/* Data Source for LLM Dropdown */}
        <div>
          <label
            htmlFor="llmDataStageSelect"
            className="mb-1 block font-medium text-gray-700 text-sm"
          >
            Processing method
          </label>
          <select
            id="llmDataStageSelect"
            name="llmDataStageSelect"
            value={selectedStage}
            onChange={(e) =>
              setSelectedStage(e.target.value as keyof LlmAllResponses)
            }
            disabled={
              overallLlmFetching || llmResponses[selectedStage]?.isLoading
            }
            className="block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base shadow-xs focus:border-orange-500 focus:outline-hidden focus:ring-orange-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-sm"
          >
            <option value="html">Slimmed HTML</option>
            <option value="textMap">Hierarchical JSON</option>
            <option value="textMapFlat">Flat JSON</option>
          </select>
        </div>
      </div>
      {/* Send to LLM Button */}
      <div className="mb-6 flex items-center justify-center">
        <button
          type="button"
          onClick={handleSendToLlm}
          aria-label={`Send ${selectedStage === "html" ? "Slimmed HTML" : selectedStage === "textMap" ? "Hierarchical JSON" : "Flat JSON"} to ${selectedLlmModel}`}
          className="w-full rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white shadow-md transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={
            overallLlmFetching ||
            !selectedStage ||
            llmResponses[selectedStage]?.isLoading
          }
        >
          {overallLlmFetching && llmResponses[selectedStage]?.isLoading
            ? "Sending to LLM..."
            : "Send to LLM"}
        </button>
      </div>
      {/* Display LLM Responses */}
      {overallLlmFetching &&
        selectedStage &&
        llmResponses[selectedStage]?.isLoading &&
        !llmResponses[selectedStage]?.content && (
          <div className="mt-6 text-center">
            <p className="animate-pulse font-semibold text-lg">
              Waiting for {selectedLlmModel} response for{" "}
              {selectedStage === "html"
                ? "Slimmed HTML"
                : selectedStage === "textMap"
                  ? "Hierarchical JSON"
                  : "Flat JSON"}
              ...
            </p>
          </div>
        )}
      {selectedStage &&
        llmResponses[selectedStage] &&
        (() => {
          const stageKey = selectedStage;
          const stageResponse = llmResponses[stageKey];
          return (
            <div
              key={stageKey}
              className="mt-4 flex flex-col rounded-lg border bg-gray-50 p-4 shadow-xs"
            >
              <h3 className="mb-3 border-b pb-2 font-semibold text-gray-800 text-lg">
                LLM Response
              </h3>
              {stageResponse.isLoading && (
                <p className="animate-pulse font-medium text-gray-700 text-md">
                  Loading response...
                </p>
              )}
              {stageResponse.error && (
                <div
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm"
                  role="alert"
                >
                  <p className="font-semibold">Error:</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {stageResponse.error}
                  </pre>
                </div>
              )}
              {!stageResponse.isLoading &&
                stageResponse.content &&
                !stageResponse.error && (
                  <>
                    {stageResponse.usage && (
                      <div className="mb-3">
                        <h4 className="mb-1 font-semibold text-gray-600 text-sm">
                          Usage:
                        </h4>
                        <div className="max-h-24 overflow-auto rounded-md border bg-white p-2 text-xs">
                          <pre className="whitespace-pre-wrap">
                            {typeof stageResponse.usage === "string"
                              ? stageResponse.usage
                              : JSON.stringify(stageResponse.usage, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    <div className="mb-3">
                      <h4 className="mb-1 font-semibold text-gray-600 text-sm">
                        Content:
                      </h4>
                      <div className="h-48 overflow-auto rounded-md border bg-white p-2 text-xs">
                        <pre className="whitespace-pre-wrap">
                          {stageResponse.content}
                        </pre>
                      </div>
                    </div>
                    {stageResponse.mappedPredictionText &&
                      stageResponse.mappedPredictionText.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center justify-between">
                            <h4 className="font-semibold text-gray-600 text-sm">
                              Predicted Text:
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleFeedback(true, `llm-${selectedStage}`)
                                }
                                disabled={
                                  feedbackSent[
                                    getCurrentFeedbackId(`llm-${selectedStage}`)
                                  ]
                                }
                                className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-green-100 ${
                                  feedbackSent[
                                    getCurrentFeedbackId(`llm-${selectedStage}`)
                                  ]
                                    ? "text-green-600"
                                    : "text-gray-400 hover:text-green-600"
                                }`}
                                aria-label="Give positive feedback"
                              >
                                <ThumbsUpIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleFeedback(false, `llm-${selectedStage}`)
                                }
                                disabled={
                                  feedbackSent[
                                    getCurrentFeedbackId(`llm-${selectedStage}`)
                                  ]
                                }
                                className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-red-100 ${
                                  feedbackSent[
                                    getCurrentFeedbackId(`llm-${selectedStage}`)
                                  ]
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
                                    stageResponse.mappedPredictionText?.join(
                                      "\n",
                                    ) || "",
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
                            {stageResponse.mappedPredictionText.map(
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
                        {stageResponse.isEvaluating && (
                          <p className="animate-pulse text-blue-500">
                            Calculating metrics...
                          </p>
                        )}
                        {!stageResponse.isEvaluating &&
                          stageResponse.predictXpathList && (
                            <>
                              <p>
                                <span className="font-semibold">
                                  Predicted Records:
                                </span>{" "}
                                {stageResponse.numPredictedRecords}
                              </p>
                              {stageResponse.numHallucination !== null && (
                                <p>
                                  <span className="font-semibold">
                                    Potential Hallucinations:
                                  </span>{" "}
                                  {stageResponse.numHallucination} (
                                  {stageResponse.numPredictedRecords &&
                                  stageResponse.numPredictedRecords > 0
                                    ? `${((stageResponse.numHallucination / stageResponse.numPredictedRecords) * 100).toFixed(2)}%`
                                    : "N/A"}
                                  )
                                </p>
                              )}
                            </>
                          )}
                        {!stageResponse.isEvaluating &&
                          stageResponse.predictXpathList &&
                          stageResponse.numPredictedRecords === null &&
                          !stageResponse.error && (
                            <p className="text-orange-500">
                              Metrics pending or encountered an issue. Check for
                              errors.
                            </p>
                          )}

                        {!stageResponse.isEvaluating &&
                          stageResponse.predictXpathList &&
                          stageResponse.numPredictedRecords === null &&
                          stageResponse.error &&
                          stageResponse.error.includes("Evaluation Error:") && (
                            <p className="text-red-500">
                              Metrics calculation failed. See error message
                              above.
                            </p>
                          )}
                        {!stageResponse.isEvaluating &&
                          !stageResponse.predictXpathList &&
                          stageResponse.content &&
                          !stageResponse.error && (
                            <p className="text-gray-500">
                              No valid XPaths parsed from LLM content.
                            </p>
                          )}
                        {!stageResponse.isEvaluating &&
                          !stageResponse.content &&
                          !stageResponse.isLoading &&
                          !stageResponse.error && (
                            <p className="text-gray-500">
                              No content to evaluate.
                            </p>
                          )}
                      </div>
                    </div>
                  </>
                )}
            </div>
          );
        })()}
    </div>
  );
}

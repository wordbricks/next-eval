'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EvaluationResult, HtmlResult } from '../lib/interfaces';
import { handleDownload } from '../lib/utils/handleDownload';
// import { calculateEvaluationMetrics } from '../lib/utils/evaluation';
import { mapResponseToFullXPath } from '../lib/utils/mapResponseToFullXpath';
import { processHtmlContent } from '../lib/utils/processHtmlContent';
import { readFileAsText } from '../lib/utils/readFileAsText';
import {
  type ValidatedXpathArray,
  parseAndValidateXPaths,
} from '../lib/utils/xpathValidation';

interface LlmStageResponse {
  content: string | null;
  usage: string | null;
  error: string | null;
  predictXpathList: ValidatedXpathArray | null;
  evaluationResult: EvaluationResult | null; // Kept for potential future use
  numPredictedRecords: number | null;
  numHallucination: number | null;
  isLoading: boolean;
  isEvaluating: boolean;
}

type LlmAllResponses = {
  html: LlmStageResponse;
  textMap: LlmStageResponse;
  textMapFlat: LlmStageResponse;
};

const initialLlmStageResponse: LlmStageResponse = {
  content: null,
  usage: null,
  error: null,
  predictXpathList: null,
  evaluationResult: null,
  numPredictedRecords: null,
  numHallucination: null,
  isLoading: false,
  isEvaluating: false,
};

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For file processing
  const [processedData, setProcessedData] = useState<HtmlResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For file processing errors

  const [llmResponses, setLlmResponses] = useState<LlmAllResponses>({
    html: { ...initialLlmStageResponse },
    textMap: { ...initialLlmStageResponse },
    textMapFlat: { ...initialLlmStageResponse },
  });
  const [overallLlmFetching, setOverallLlmFetching] = useState<boolean>(false); // For the "Send All to Gemini" button

  const fileInputRef = useRef<HTMLInputElement>(null);

  // useEffect(() => {
  //   if (processedData && !selectedStage) { // selectedStage is removed
  //     setSelectedStage('textMapFlat');
  //   }
  // }, [processedData, selectedStage]); // selectedStage removed

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
      setProcessedData(null);
      // Reset LLM responses when a new file is selected
      setLlmResponses({
        html: { ...initialLlmStageResponse },
        textMap: { ...initialLlmStageResponse },
        textMapFlat: { ...initialLlmStageResponse },
      });
      setOverallLlmFetching(false);
    } else {
      setSelectedFile(null);
    }
  };

  const handleProcessFile = useCallback(async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an HTML file first.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProcessedData(null);
    // Reset LLM states as well
    setLlmResponses({
      html: { ...initialLlmStageResponse },
      textMap: { ...initialLlmStageResponse },
      textMapFlat: { ...initialLlmStageResponse },
    });
    setOverallLlmFetching(false);

    try {
      const htmlString = await readFileAsText(selectedFile);
      const originalHtmlLength = htmlString.length;

      const processedContent = await processHtmlContent(htmlString);

      setProcessedData({
        ...processedContent,
        originalHtml: htmlString,
        originalHtmlLength,
      });
    } catch (error) {
      console.error('Client-side processing error:', error);
      if (error instanceof Error) {
        setErrorMessage(`Processing error: ${error.message}`);
      } else {
        setErrorMessage(
          'An unknown error occurred during client-side processing.',
        );
      }
      setProcessedData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile]);

  const handleSendToLlm = async () => {
    if (!processedData) {
      // This should ideally not happen if button is disabled correctly
      console.error('Processed data not available for LLM request.');
      // Optionally set a general error message for LLM section
      return;
    }

    setOverallLlmFetching(true);
    // Initialize/reset states for all stages
    setLlmResponses((prev) => ({
      html: { ...initialLlmStageResponse, isLoading: true },
      textMap: { ...initialLlmStageResponse, isLoading: true },
      textMapFlat: { ...initialLlmStageResponse, isLoading: true },
    }));

    const stagesMetaData = [
      {
        key: 'html' as keyof LlmAllResponses,
        data: processedData.html,
        promptType: 'slim',
      },
      {
        key: 'textMap' as keyof LlmAllResponses,
        data: processedData.textMap,
        promptType: 'hierarchical',
      },
      {
        key: 'textMapFlat' as keyof LlmAllResponses,
        data: processedData.textMapFlat,
        promptType: 'flat',
      },
    ];

    const requests = stagesMetaData.map(async (stage) => {
      try {
        const requestBody = {
          promptType: stage.promptType,
          data: JSON.stringify(stage.data, null, 2), // Data is stringified here
        };

        const response = await fetch('/next-eval/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: `LLM API request for ${stage.key} failed with status ${response.status} and could not parse error.`,
          }));
          throw new Error(
            errorData.message ||
              `LLM API request for ${stage.key} failed with status ${response.status}`,
          );
        }

        const result = await response.json();
        if ('content' in result && 'usage' in result) {
          const validatedPredXPaths = parseAndValidateXPaths(result.content);
          setLlmResponses((prev) => ({
            ...prev,
            [stage.key]: {
              ...prev[stage.key],
              content: result.content,
              usage: result.usage,
              predictXpathList: validatedPredXPaths,
              error: null,
              isLoading: false,
              // Reset evaluation metrics and state for fresh evaluation
              numPredictedRecords: null,
              numHallucination: null,
              evaluationResult: null,
              isEvaluating: false,
            },
          }));
        } else {
          throw new Error(
            `Unexpected response structure for ${stage.key}: ${JSON.stringify(result, null, 2)}`,
          );
        }
      } catch (error) {
        console.error(`Error sending to LLM for stage ${stage.key}:`, error);
        setLlmResponses((prev) => ({
          ...prev,
          [stage.key]: {
            ...prev[stage.key],
            error: error instanceof Error ? error.message : String(error),
            content: null,
            usage: null,
            predictXpathList: null,
            isLoading: false,
            // Also reset metrics and eval state on error
            numPredictedRecords: null,
            numHallucination: null,
            evaluationResult: null,
            isEvaluating: false,
          },
        }));
      }
    });

    await Promise.allSettled(requests);
    setOverallLlmFetching(false);
  };

  useEffect(() => {
    if (selectedFile) {
      handleProcessFile();
    }
  }, [selectedFile, handleProcessFile]);

  useEffect(() => {
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
              evaluationResult: null,
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

        // Step 1: If we have new XPaths, aren't loading/evaluating, and metrics are not yet computed, set to isEvaluating
        if (
          stageData.predictXpathList &&
          !stageData.isLoading &&
          !stageData.isEvaluating &&
          stageData.numPredictedRecords === null // Only if metrics are not yet computed
        ) {
          newResponses[stageKey] = {
            ...stageData,
            isEvaluating: true,
            // Clear any previous evaluation-specific errors
            error: stageData.error?.includes('Evaluation Error:')
              ? stageData.error
                  .split('\n')
                  .filter((line) => !line.startsWith('Evaluation Error:'))
                  .join('\n') || null
              : stageData.error,
          };
          updateScheduled = true;
        }
        // Step 2: If isEvaluating is true, perform the evaluation
        else if (stageData.isEvaluating && !stageData.isLoading) {
          try {
            if (!stageData.predictXpathList) {
              // This case should ideally be prevented by the reset in handleSendToLlm or if LLM call fails
              // but as a safeguard, if predictXpathList is gone while we are in isEvaluating, reset.
              newResponses[stageKey] = {
                ...stageData,
                isEvaluating: false,
                numPredictedRecords: null,
                numHallucination: null,
                evaluationResult: null,
                error: `${stageData.error ? `${stageData.error}\n` : ''}Evaluation Error: XPaths disappeared during evaluation. Resetting metrics.`,
              };
              updateScheduled = true;
              return; // continue to next stageKey in forEach
            }

            const localNumPredictedRecords = stageData.predictXpathList.length;
            const mappedPredRecords = mapResponseToFullXPath(
              textMapFlatForEval,
              stageData.predictXpathList,
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
              isEvaluating: false,
              // Evaluation successful, error remains as is (or cleared in step 1 if it was an eval error)
            };
            updateScheduled = true;
          } catch (evalError) {
            console.error(
              `Error during evaluation for ${stageKey}:`,
              evalError,
            );
            newResponses[stageKey] = {
              ...stageData,
              error: `${stageData.error ? `${stageData.error}\n` : ''}Evaluation Error: ${evalError instanceof Error ? evalError.message : String(evalError)}`,
              numPredictedRecords: null,
              numHallucination: null,
              isEvaluating: false,
            };
            updateScheduled = true;
          }
        }
        // Step 3: If predictXpathList becomes null (e.g. error during LLM fetch after successful fetch),
        // and we are not currently loading/evaluating, ensure metrics are cleared.
        // This is a cleanup step.
        else if (
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
            evaluationResult: null, // Kept for consistency
            isEvaluating: false,
          };
          updateScheduled = true;
        }
      }

      return updateScheduled ? newResponses : prevResponses;
    });
  }, [processedData?.textMapFlat]);

  const handleLoadSyntheticData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setProcessedData(null);
    setLlmResponses({
      // Reset LLM states
      html: { ...initialLlmStageResponse },
      textMap: { ...initialLlmStageResponse },
      textMapFlat: { ...initialLlmStageResponse },
    });
    setOverallLlmFetching(false);

    const htmlPath = '/next-eval/sample.html';

    try {
      const htmlResponse = await fetch(htmlPath);
      if (!htmlResponse.ok) {
        throw new Error(
          `Failed to fetch ${htmlPath}: ${htmlResponse.status} ${htmlResponse.statusText}`,
        );
      }
      const htmlString = await htmlResponse.text();
      const originalHtmlLength = htmlString.length;
      const processedContent = await processHtmlContent(htmlString);
      setProcessedData({
        ...processedContent,
        originalHtml: htmlString,
        originalHtmlLength,
      });
    } catch (error) {
      console.error('Error loading synthetic data', error);
      if (error instanceof Error) {
        setErrorMessage(`Error loading synthetic data: ${error.message}`);
      } else {
        setErrorMessage(
          'An unknown error occurred while loading synthetic data',
        );
      }
      // Clear partial data on main error
      setProcessedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-[1200px]">
      <h1 className="text-3xl font-bold text-center my-8">
        NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record
        Extraction
      </h1>
      {/* File Input Section */}
      <section className="mb-8 p-6 border rounded-lg shadow-md bg-white">
        <h2 className="text-xl font-semibold mb-4">
          Upload HTML or Load Sample Data
        </h2>
        <div className="flex flex-row items-start space-x-6">
          {/* Option 1: Upload your own HTML file */}
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Upload your own HTML file.
            </p>
            <input
              type="file"
              aria-label="Upload HTML or MHTML file"
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-violet-50 file:text-violet-700
                hover:file:bg-violet-100
                focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
                p-2 border border-gray-300 rounded-md shadow-sm"
              accept=".html"
              onChange={handleFileChange}
              disabled={isLoading || overallLlmFetching}
              ref={fileInputRef}
            />
          </div>

          {/* Separator */}
          <div className="flex flex-col items-center justify-start pt-8">
            <span className="text-sm font-medium text-gray-500">Or</span>
          </div>

          {/* Option 2: Load Sample HTML */}
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Load a sample HTML file for quick testing.
            </p>
            <button
              type="button"
              onClick={handleLoadSyntheticData}
              className="w-full px-6 py-2 bg-teal-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || overallLlmFetching}
              aria-label="Load sample HTML data"
            >
              Load Sample HTML
            </button>
          </div>
        </div>
        {errorMessage && (
          <p className="mt-6 text-sm text-red-600" role="alert">
            Error: {errorMessage}
          </p>
        )}
      </section>

      {/* Conditional rendering for side-by-side or individual display */}
      {processedData?.originalHtml && !isLoading ? (
        <section className="w-full p-6 border rounded-lg shadow-md bg-white mb-4 md:mb-0">
          <h2 className="text-xl font-semibold mb-4">Original HTML Content</h2>
          {processedData.originalHtmlLength !== undefined && (
            <p className="text-sm text-gray-600 mb-2">
              Length: {processedData.originalHtmlLength.toLocaleString()}{' '}
              characters
            </p>
          )}
          <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
            <pre className="text-sm whitespace-pre-wrap">
              {processedData.originalHtml}
            </pre>
          </div>
        </section>
      ) : (
        <>
          {/* Display Original HTML Content Section (if only this is available) */}
          {processedData?.originalHtml && !isLoading && (
            <section className="mb-8 p-6 border rounded-lg shadow-md bg-white">
              <h2 className="text-xl font-semibold mb-4">
                Original HTML Content
              </h2>
              {processedData.originalHtmlLength !== undefined && (
                <p className="text-sm text-gray-600 mb-2">
                  Length: {processedData.originalHtmlLength.toLocaleString()}{' '}
                  characters
                </p>
              )}
              <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
                <pre className="text-sm whitespace-pre-wrap">
                  {processedData.originalHtml}
                </pre>
              </div>
            </section>
          )}
        </>
      )}

      {/* Loading Indicator - more prominent */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-lg font-semibold animate-pulse">
              Processing file, please wait...
            </p>
            {/* You can add a spinner SVG or component here */}
          </div>
        </div>
      )}

      {/* Processing Steps Section */}
      {processedData && !isLoading && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Processing Stages</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stage 1: Slimmed HTML (Cleaned HTML) */}
            <div
              className="p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between"
              aria-label="Slimmed HTML stage content"
            >
              <div>
                <h3 className="text-lg font-medium mb-1">
                  1. Slimmed HTML (attributes removed){' '}
                </h3>
                <p className="text-xs text-gray-600 mb-2">
                  Length: {processedData.htmlLength.toLocaleString()} chars
                </p>
                <div className="h-64 overflow-auto bg-white p-2 border rounded mb-2">
                  <pre className="text-xs whitespace-pre-wrap">
                    {processedData.html}
                  </pre>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(
                    processedData.html,
                    'slimmed_html.html',
                    'text/html',
                  );
                }}
                className="mt-2 px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out self-start"
                aria-label="Download slimmed HTML"
              >
                Download HTML
              </button>
            </div>

            {/* Stage 3: Hierarchical Text Map - MOVED TO STAGE 2 */}
            <div
              className="p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between"
              aria-label="Hierarchical JSON stage content"
            >
              <div>
                <h3 className="text-lg font-medium mb-1">
                  2. Hierarchical JSON (Nested text map)
                </h3>
                <p className="text-xs text-gray-600 mb-2">
                  Length: {processedData.textMapLength.toLocaleString()} chars
                  (JSON string)
                </p>
                <div className="h-64 overflow-auto bg-white p-2 border rounded mb-2">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(processedData.textMap, null, 2)}
                  </pre>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(
                    JSON.stringify(processedData.textMap, null, 2),
                    'hierarchical_map.json',
                    'application/json',
                  );
                }}
                className="mt-2 px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out self-start"
                aria-label="Download hierarchical JSON map"
              >
                Download Hierarchical JSON
              </button>
            </div>

            {/* Stage 2: XPath to Text (Flat) - MOVED TO STAGE 3 */}
            <div
              className="p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between"
              aria-label="Flat JSON stage content"
            >
              <div>
                <h3 className="text-lg font-medium mb-1">
                  3. Flat JSON (text map)
                </h3>
                <p className="text-xs text-gray-600 mb-2">
                  Length: {processedData.textMapFlatLength.toLocaleString()}{' '}
                  chars (JSON string)
                </p>
                <div className="h-64 overflow-auto bg-white p-2 border rounded mb-2">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(processedData.textMapFlat, null, 2)}
                  </pre>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(
                    JSON.stringify(processedData.textMapFlat, null, 2),
                    'flat_map.json',
                    'application/json',
                  );
                }}
                className="mt-2 px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out self-start"
                aria-label="Download flat JSON map"
              >
                Download Flat JSON
              </button>
            </div>
          </div>
        </section>
      )}

      {/* LLM Interaction Section */}
      {processedData && !isLoading && (
        <section className="mt-8 p-6 border rounded-lg shadow-md bg-white">
          <h2 className="text-xl font-semibold mb-4">
            LLM Interaction (Gemini 2.5 Pro) - All Stages
          </h2>
          <div className="flex justify-center items-center mb-6">
            <button
              type="button"
              onClick={handleSendToLlm}
              aria-label="Send all processed stages to LLM"
              className="w-full sm:w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!processedData || overallLlmFetching}
            >
              {overallLlmFetching
                ? 'Sending to Gemini...'
                : 'Send All Stages to Gemini'}
            </button>
          </div>

          {/* Display LLM Responses in a Grid */}
          {overallLlmFetching &&
            !llmResponses.html.content &&
            !llmResponses.textMap.content &&
            !llmResponses.textMapFlat.content && (
              <div className="mt-6 text-center">
                <p className="text-lg font-semibold animate-pulse">
                  Waiting for LLM responses...
                </p>
              </div>
            )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.keys(llmResponses) as Array<keyof LlmAllResponses>).map(
              (stageKey) => {
                const stageResponse = llmResponses[stageKey];
                const stageTitles: Record<keyof LlmAllResponses, string> = {
                  html: 'Slimmed HTML Response',
                  textMap: 'Hierarchical JSON Response',
                  textMapFlat: 'Flat JSON Response',
                };

                return (
                  <div
                    key={stageKey}
                    className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col"
                  >
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">
                      {stageTitles[stageKey]}
                    </h3>
                    {stageResponse.isLoading && (
                      <p className="text-md font-medium text-blue-600 animate-pulse">
                        Loading response...
                      </p>
                    )}
                    {stageResponse.error && (
                      <div
                        className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm"
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
                              <h4 className="text-sm font-semibold mb-1 text-gray-600">
                                Usage:
                              </h4>
                              <div className="max-h-32 overflow-auto bg-white p-2 border rounded-md text-xs">
                                <pre className="whitespace-pre-wrap">
                                  {typeof stageResponse.usage === 'string'
                                    ? stageResponse.usage
                                    : JSON.stringify(
                                        stageResponse.usage,
                                        null,
                                        2,
                                      )}
                                </pre>
                              </div>
                            </div>
                          )}
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold mb-1 text-gray-600">
                              Content:
                            </h4>
                            <div className="h-64 overflow-auto bg-white p-2 border rounded-md text-xs">
                              <pre className="whitespace-pre-wrap">
                                {stageResponse.content}
                              </pre>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold mb-1 text-gray-600">
                              Evaluation Metrics:
                            </h4>
                            <div className="p-2 bg-blue-50 border border-blue-100 rounded-md space-y-1 text-xs">
                              {stageResponse.isEvaluating && (
                                <p className="text-blue-500 animate-pulse">
                                  Calculating metrics...
                                </p>
                              )}
                              {!stageResponse.isEvaluating &&
                                stageResponse.predictXpathList && (
                                  <>
                                    {stageResponse.numPredictedRecords !==
                                      null && (
                                      <p>
                                        <span className="font-semibold">
                                          Predicted Records:
                                        </span>{' '}
                                        {stageResponse.numPredictedRecords}
                                      </p>
                                    )}
                                    {stageResponse.numHallucination !==
                                      null && (
                                      <p>
                                        <span className="font-semibold">
                                          Potential Hallucinations:
                                        </span>{' '}
                                        {stageResponse.numHallucination} (
                                        {stageResponse.numPredictedRecords &&
                                        stageResponse.numPredictedRecords > 0
                                          ? `${((stageResponse.numHallucination / stageResponse.numPredictedRecords) * 100).toFixed(2)}%`
                                          : 'N/A'}
                                        )
                                      </p>
                                    )}
                                  </>
                                )}
                              {!stageResponse.isEvaluating &&
                                !stageResponse.predictXpathList &&
                                !stageResponse.error &&
                                stageResponse.content && (
                                  <p className="text-gray-500">
                                    Metrics not available (no valid XPaths
                                    predicted or error in content).
                                  </p>
                                )}
                              {!stageResponse.isEvaluating &&
                                !stageResponse.content &&
                                !stageResponse.isLoading && (
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
              },
            )}
          </div>
        </section>
      )}
    </main>
  );
}

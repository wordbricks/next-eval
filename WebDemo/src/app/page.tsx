'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HtmlResult } from '../lib/interfaces';
import { handleDownload } from '../lib/utils/handleDownload';
// import { calculateEvaluationMetrics } from '../lib/utils/evaluation';
import { mapResponseToFullXPath } from '../lib/utils/mapResponseToFullXpath';
import { processHtmlContent } from '../lib/utils/processHtmlContent';
import { readFileAsText } from '../lib/utils/readFileAsText';
import { runMDR } from '../lib/utils/runMDR';
import {
  type ValidatedXpathArray,
  parseAndValidateXPaths,
} from '../lib/utils/xpathValidation';

interface LlmStageResponse {
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

interface MdrResponseState {
  predictXpathList: ValidatedXpathArray | null;
  mappedPredictionText: string[] | null;
  numPredictedRecords: number | null;
  isLoading: boolean;
  error: string | null;
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
  numPredictedRecords: null,
  numHallucination: null,
  mappedPredictionText: null,
  isLoading: false,
  isEvaluating: false,
};

const initialMdrResponseState: MdrResponseState = {
  predictXpathList: null,
  mappedPredictionText: null,
  numPredictedRecords: null,
  isLoading: false,
  error: null,
};

const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <title>Download Icon</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For file processing
  const [processedData, setProcessedData] = useState<HtmlResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For file processing errors
  const [selectedStage, setSelectedStage] =
    useState<keyof LlmAllResponses>('textMapFlat');

  const [llmResponses, setLlmResponses] = useState<LlmAllResponses>({
    html: { ...initialLlmStageResponse },
    textMap: { ...initialLlmStageResponse },
    textMapFlat: { ...initialLlmStageResponse },
  });
  const [overallLlmFetching, setOverallLlmFetching] = useState<boolean>(false); // For the "Send All to Gemini" button
  const [mdrResponse, setMdrResponse] = useState<MdrResponseState>({
    ...initialMdrResponseState,
  }); // Added MDR state

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
      setSelectedStage('textMapFlat');
      setMdrResponse({ ...initialMdrResponseState }); // Reset MDR response
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
    setSelectedStage('textMapFlat');
    setMdrResponse({ ...initialMdrResponseState }); // Reset MDR response

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
    if (!selectedStage) {
      // Ensure a stage is selected
      console.error('No stage selected for LLM request.');
      // Optionally set an error message
      return;
    }

    setOverallLlmFetching(true);
    // Initialize/reset states for the selected stage
    setLlmResponses((prev) => ({
      ...prev,
      [selectedStage]: { ...initialLlmStageResponse, isLoading: true },
    }));

    const stageKey = selectedStage;
    let stageDataForLlm: string | Record<string, unknown> | undefined;
    let promptTypeForLlm: string | undefined;

    if (stageKey === 'html') {
      stageDataForLlm = processedData.html;
      promptTypeForLlm = 'slim';
    } else if (stageKey === 'textMap') {
      stageDataForLlm = processedData.textMap;
      promptTypeForLlm = 'hierarchical';
    } else if (stageKey === 'textMapFlat') {
      stageDataForLlm = processedData.textMapFlat;
      promptTypeForLlm = 'flat';
    } else {
      console.error(`Unknown stage key: ${stageKey} for LLM request.`);
      setOverallLlmFetching(false);
      setLlmResponses((prev) => ({
        ...prev,
        [stageKey]: {
          ...initialLlmStageResponse,
          error: 'Unknown stage selected',
          isLoading: false,
        },
      }));
      return;
    }

    try {
      const requestBody = {
        promptType: promptTypeForLlm,
        data: JSON.stringify(stageDataForLlm, null, 2), // Data is stringified here
      };

      const response = await fetch('/next-eval/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if ('content' in result && 'usage' in result) {
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
  };

  const handleRunMdr = async () => {
    if (!processedData?.originalHtml || !processedData.textMapFlat) {
      console.error(
        'Original HTML or textMapFlat not available for MDR execution.',
      );
      setMdrResponse((prev) => ({
        ...prev,
        error:
          'Required data (original HTML or text map) is not processed yet.',
        isLoading: false,
      }));
      return;
    }

    setMdrResponse({
      ...initialMdrResponseState,
      isLoading: true,
    });

    try {
      // Assuming runMDR is not excessively long-running for now.
      // For very large HTML or complex MDR, consider a Web Worker.
      const mdrPredictedXPaths = runMDR(processedData.originalHtml);

      if (!mdrPredictedXPaths || mdrPredictedXPaths.length === 0) {
        setMdrResponse((prev) => ({
          ...prev,
          predictXpathList: [],
          mappedPredictionText: [],
          numPredictedRecords: 0,
          isLoading: false,
          error: 'MDR returned no XPaths.',
        }));
        return;
      }

      // Validate XPaths (optional, but good for consistency if parseAndValidateXPaths is used elsewhere for LLM)
      // For now, we directly use the output of runMDR assuming it's string[][]
      const validatedMdrXPaths: ValidatedXpathArray =
        mdrPredictedXPaths as ValidatedXpathArray;

      const textMapFlatForEval = processedData.textMapFlat as Record<
        string,
        string
      >;

      const mappedText = validatedMdrXPaths
        .filter((xpathArray) =>
          xpathArray.some((xpath) => xpath in textMapFlatForEval),
        )
        .map((xpathArray) =>
          xpathArray
            .filter((xpath) => xpath in textMapFlatForEval)
            .map((xpath) => textMapFlatForEval[xpath])
            .join(' '),
        );

      setMdrResponse({
        predictXpathList: validatedMdrXPaths,
        mappedPredictionText: mappedText,
        numPredictedRecords: validatedMdrXPaths.length,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error running MDR:', error);
      setMdrResponse({
        ...initialMdrResponseState,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
                mappedPredictionText: null,
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

            const mappedPredRecordsText = mappedPredRecords.map((xpathArray) =>
              xpathArray.map((xpath) => textMapFlatForEval[xpath]).join(' '),
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
    setSelectedStage('textMapFlat');
    setMdrResponse({ ...initialMdrResponseState }); // Reset MDR response

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
          <div className="h-64 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
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
              <div className="h-64 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
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
              className={`p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ease-in-out ${selectedStage === 'html' ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => setSelectedStage('html')}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedStage('html')}
              tabIndex={0}
              role="button"
              aria-pressed={selectedStage === 'html'}
              aria-label="Select Slimmed HTML stage and view its content"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">1. Slimmed HTML</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent stage selection when clicking download
                    handleDownload(
                      processedData.html,
                      'slimmed_html.html',
                      'text/html',
                    );
                  }}
                  className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-full transition-colors duration-150 ease-in-out"
                  aria-label="Download slimmed HTML"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-2">
                  (attributes removed) Length:{' '}
                  {processedData.htmlLength.toLocaleString()} chars
                </p>
                <div className="h-64 overflow-auto bg-white p-2 border rounded">
                  <pre className="text-xs whitespace-pre-wrap">
                    {processedData.html}
                  </pre>
                </div>
              </div>
            </div>

            {/* Stage 2: Hierarchical JSON (Nested text map) */}
            <div
              className={`p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ease-in-out ${selectedStage === 'textMap' ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => setSelectedStage('textMap')}
              onKeyDown={(e) =>
                e.key === 'Enter' && setSelectedStage('textMap')
              }
              tabIndex={0}
              role="button"
              aria-pressed={selectedStage === 'textMap'}
              aria-label="Select Hierarchical JSON stage and view its content"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">2. Hierarchical JSON</h3>
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
                  className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-full transition-colors duration-150 ease-in-out"
                  aria-label="Download hierarchical JSON map"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-2">
                  (Nested text map) Length:{' '}
                  {processedData.textMapLength.toLocaleString()} chars (JSON
                  string)
                </p>
                <div className="h-64 overflow-auto bg-white p-2 border rounded">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(processedData.textMap, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Stage 3: Flat JSON (text map) */}
            <div
              className={`p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ease-in-out ${selectedStage === 'textMapFlat' ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => setSelectedStage('textMapFlat')}
              onKeyDown={(e) =>
                e.key === 'Enter' && setSelectedStage('textMapFlat')
              }
              tabIndex={0}
              role="button"
              aria-pressed={selectedStage === 'textMapFlat'}
              aria-label="Select Flat JSON stage and view its content"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">3. Flat JSON</h3>
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
                  className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-full transition-colors duration-150 ease-in-out"
                  aria-label="Download flat JSON map"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-2">
                  (text map) Length:{' '}
                  {processedData.textMapFlatLength.toLocaleString()} chars (JSON
                  string)
                </p>
                <div className="h-64 overflow-auto bg-white p-2 border rounded">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(processedData.textMapFlat, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* LLM Interaction Section */}
      {processedData && !isLoading && (
        <section className="mt-8 p-6 border rounded-lg shadow-md bg-white">
          <h2 className="text-xl font-semibold mb-4">
            LLM Interaction (Gemini 2.5 Pro) & MDR Algorithm
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center mb-6 gap-4">
            <button
              type="button"
              onClick={handleSendToLlm}
              aria-label={`Send ${selectedStage === 'html' ? 'Slimmed HTML' : selectedStage === 'textMap' ? 'Hierarchical JSON' : 'Flat JSON'} to LLM`}
              className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !processedData ||
                overallLlmFetching ||
                !selectedStage ||
                mdrResponse.isLoading
              }
            >
              {overallLlmFetching
                ? `Sending ${selectedStage === 'html' ? 'Slimmed HTML' : selectedStage === 'textMap' ? 'Hierarchical JSON' : 'Flat JSON'} to Gemini...`
                : `Send ${selectedStage === 'html' ? 'Slimmed HTML' : selectedStage === 'textMap' ? 'Hierarchical JSON' : 'Flat JSON'} to Gemini`}
            </button>
            <button
              type="button"
              onClick={handleRunMdr}
              aria-label="Run MDR Algorithm on Original HTML"
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !processedData?.originalHtml ||
                mdrResponse.isLoading ||
                overallLlmFetching
              }
            >
              {mdrResponse.isLoading ? 'Running MDR...' : 'Run MDR Algorithm'}
            </button>
          </div>

          {/* Display LLM Responses in a Grid */}
          {overallLlmFetching &&
            selectedStage && // Check if selectedStage is defined
            llmResponses[selectedStage]?.isLoading && // Check if llmResponses[selectedStage] exists and isLoading
            !llmResponses[selectedStage]?.content && (
              <div className="mt-6 text-center">
                <p className="text-lg font-semibold animate-pulse">
                  Waiting for LLM response for{' '}
                  {selectedStage === 'html'
                    ? 'Slimmed HTML'
                    : selectedStage === 'textMap'
                      ? 'Hierarchical JSON'
                      : 'Flat JSON'}
                  ...
                </p>
              </div>
            )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {' '}
            {/* Grid for LLM and MDR cards */}
            {/* Display LLM Response for the selectedStage */}
            {selectedStage &&
              llmResponses[selectedStage] &&
              (() => {
                const stageKey = selectedStage;
                const stageResponse = llmResponses[stageKey];
                const stageTitles: Record<keyof LlmAllResponses, string> = {
                  html: 'Slimmed HTML Response',
                  textMap: 'Hierarchical JSON Response',
                  textMapFlat: 'Flat JSON Response',
                };

                return (
                  <div
                    key={stageKey} // key is still useful for React even with one item if it can change
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
                          {stageResponse.mappedPredictionText &&
                            stageResponse.mappedPredictionText.length > 0 && (
                              <div className="mb-3">
                                <h4 className="text-sm font-semibold mb-1 text-gray-600">
                                  Mapped Predicted Text (from XPaths):
                                </h4>
                                <div className="h-48 overflow-auto bg-white p-2 border rounded-md text-xs">
                                  {stageResponse.mappedPredictionText.map((textBlock, index) => (
                                    <pre key={`${textBlock}-${index}`} className="whitespace-pre-wrap py-1 my-1 border-b border-gray-200 last:border-b-0">
                                      {textBlock}
                                    </pre>
                                  ))}
                                </div>
                              </div>
                            )}
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
                                stageResponse.predictXpathList && ( // Metrics successfully calculated
                                  <>
                                    <p>
                                      <span className="font-semibold">
                                        Predicted Records:
                                      </span>{' '}
                                      {stageResponse.numPredictedRecords}
                                    </p>
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
                                stageResponse.predictXpathList && // XPaths were present
                                stageResponse.numPredictedRecords === null && // But metrics calculation failed or was reset (error should be shown by stageResponse.error)
                                !stageResponse.error && ( // If no specific eval error is set, this is an unexpected state.
                                  <p className="text-orange-500">
                                    Metrics pending or encountered an issue.
                                    Check for errors.
                                  </p>
                                )}

                              {!stageResponse.isEvaluating &&
                                stageResponse.predictXpathList &&
                                stageResponse.numPredictedRecords === null &&
                                stageResponse.error &&
                                stageResponse.error.includes(
                                  'Evaluation Error:',
                                ) && ( // Explicitly check if an Evaluation Error occurred
                                  <p className="text-red-500">
                                    Metrics calculation failed. See error
                                    message above.
                                  </p>
                                )}

                              {!stageResponse.isEvaluating &&
                                !stageResponse.predictXpathList && // XPaths could not be parsed
                                stageResponse.content && // But LLM content was present
                                !stageResponse.error && ( // And no other error (like API error)
                                  <p className="text-gray-500">
                                    No valid XPaths parsed from LLM content.
                                  </p>
                                )}

                              {!stageResponse.isEvaluating &&
                                !stageResponse.content && // No LLM content at all
                                !stageResponse.isLoading && // And not loading
                                !stageResponse.error && ( // And no error
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
            {/* MDR Response Card */}
            {processedData && !isLoading && (
              <div className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col">
                <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">
                  MDR Algorithm Response
                </h3>
                {mdrResponse.isLoading && (
                  <p className="text-md font-medium text-blue-600 animate-pulse">
                    Processing with MDR, please wait...
                  </p>
                )}
                {mdrResponse.error && (
                  <div
                    className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm"
                    role="alert"
                  >
                    <p className="font-semibold">MDR Error:</p>
                    <pre className="whitespace-pre-wrap break-all">
                      {mdrResponse.error}
                    </pre>
                  </div>
                )}
                {!mdrResponse.isLoading &&
                  (mdrResponse.predictXpathList || mdrResponse.error) &&
                  !mdrResponse.error && (
                    <>
                      {mdrResponse.predictXpathList && (
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold mb-1 text-gray-600">
                            Predicted XPaths:
                          </h4>
                          <div className="h-64 overflow-auto bg-gray-100 p-2 border rounded-md text-xs">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(
                                mdrResponse.predictXpathList,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        </div>
                      )}
                      {mdrResponse.mappedPredictionText &&
                        mdrResponse.mappedPredictionText.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold mb-1 text-gray-600">
                              Mapped Predicted Text:
                            </h4>
                            <div className="h-48 overflow-auto bg-white p-2 border rounded-md text-xs">
                              {mdrResponse.mappedPredictionText.map((textBlock, index) => (
                                <pre
                                  key={`${textBlock}-${index}`}
                                  className="whitespace-pre-wrap py-1 my-1 border-b border-gray-200 last:border-b-0"
                                >
                                  {textBlock}
                                </pre>
                              ))}
                            </div>
                          </div>
                        )}
                      <div>
                        <h4 className="text-sm font-semibold mb-1 text-gray-600">
                          Evaluation Metrics:
                        </h4>
                        <div className="p-2 bg-blue-50 border border-blue-100 rounded-md space-y-1 text-xs">
                          {mdrResponse.numPredictedRecords !== null && (
                            <p>
                              <span className="font-semibold">
                                Predicted Records:
                              </span>{' '}
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
                {!mdrResponse.isLoading &&
                  !mdrResponse.predictXpathList &&
                  !mdrResponse.error && (
                    <p className="text-gray-500">Run MDR to see results.</p>
                  )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

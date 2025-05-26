'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HtmlResult, EvaluationResult, NestedTextMap } from '../lib/interfaces';
// import { calculateEvaluationMetrics } from '../lib/utils/evaluation';
import { mapResponseToFullXPath } from '../lib/utils/mapResponseToFullXpath';
import { handleDownload } from '../lib/utils/handleDownload';
import { processHtmlContent } from '../lib/utils/processHtmlContent';
import { readFileAsText } from '../lib/utils/readFileAsText';
import {
  type ValidatedXpathArray,
  parseAndValidateXPaths,
} from '../lib/utils/xpathValidation';

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processedData, setProcessedData] = useState<HtmlResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<
    'html' | 'textMapFlat' | 'textMap' | null
  >(null);
  const [llmResponseContent, setLlmResponseContent] = useState<string | null>(null);
  const [llmResponseUsage, setLlmResponseUsage] = useState<string | null>(null);
  const [isLlmLoading, setIsLlmLoading] = useState<boolean>(false);
  const [llmErrorMessage, setLlmErrorMessage] = useState<string | null>(null);
  const [predictXpathList, setPredictXpathList] =
    useState<ValidatedXpathArray | null>(null);
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [numPredictedRecords, setNumPredictedRecords] = useState<number | null>(
    null,
  );
  const [numHallucination, setNumHallucination] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (processedData && !selectedStage) {
      setSelectedStage('textMapFlat');
    }
  }, [processedData, selectedStage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null); // Clear previous errors
      setProcessedData(null); // Clear previous data
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
    setLlmResponseContent(null);
    setLlmResponseUsage(null);
    setLlmErrorMessage(null);
    setSelectedStage(null);
    setPredictXpathList(null);
    setEvaluationResult(null);

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
      setProcessedData(null); // Clear any partial data
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedFile,
    // readFileAsText and processHtmlContent are stable and don't need to be in deps
  ]);

  const handleSendToLlm = async () => {
    if (!selectedStage || !processedData) {
      setLlmErrorMessage(
        'Please select a processing stage and ensure data is available.',
      );
      return;
    }

    setIsLlmLoading(true);
    setLlmErrorMessage(null);
    setLlmResponseContent(null);
    setLlmResponseUsage(null);
    setPredictXpathList(null); // Clear previous LLM-generated XPaths
    setEvaluationResult(null); // Clear previous evaluation

    try {
      const promptTypeMap = {
        html: 'slim',
        textMapFlat: 'flat',
        textMap: 'hierarchical',
      } as const;

      // Prepare data: use stringified version for maps, direct HTML for 'html' stage
      let dataToSend: string | Record<string, string> | NestedTextMap | undefined;
      if (selectedStage === 'html') {
        dataToSend = processedData.html;
      } else if (selectedStage === 'textMapFlat') {
        dataToSend = processedData.textMapFlat; // Send the object, not stringified
      } else if (selectedStage === 'textMap') {
        dataToSend = processedData.textMap; // Send the object, not stringified
      } else {
        throw new Error('Invalid stage selected for LLM interaction');
      }

      const requestBody = {
        promptType: promptTypeMap[selectedStage as keyof typeof promptTypeMap],
        data: JSON.stringify(dataToSend, null, 2),
      };

      const response = await fetch('/next-eval/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Failed to get response from LLM and could not parse error.',
        }));
        throw new Error(
          errorData.message ||
            `LLM API request failed with status ${response.status}`,
        );
      }

      const result = await response.json();
      console.log('result', result);
      if (
        'content' in result &&
        'usage' in result
      ) {
        const { content: llmContent, usage: llmUsage } = result;
        const validatedPredXPaths = parseAndValidateXPaths(llmContent);
        console.log('validatedPredXPaths', validatedPredXPaths);
        setLlmResponseContent(llmContent);
        setLlmResponseUsage(llmUsage);
        setPredictXpathList(validatedPredXPaths);
      } else {
        // Fallback if structure is not as expected but response was 'ok'
        setLlmResponseContent(
          `Unexpected response structure: ${JSON.stringify(result, null, 2)}`,
        );
        setLlmResponseUsage('Unknown');
        setPredictXpathList(null); // Ensure evaluation clears
      }
    } catch (error) {
      console.error(`Error sending to LLM: ${error}`);
      setPredictXpathList(null); // Ensure reset on error
      if (error instanceof Error) {
        setLlmErrorMessage(`LLM Error: ${error.message}`);
      } else {
        setLlmErrorMessage(
          'An unknown error occurred while contacting the LLM.',
        );
      }
    } finally {
      setIsLlmLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFile) {
      handleProcessFile();
    }
  }, [selectedFile, handleProcessFile]);

  // Effect to run evaluation when necessary data is available
  useEffect(() => {
    if (
      // groundTruthXpathList && // No longer available for synthetic
      predictXpathList &&
      processedData?.textMapFlat
    ) {
      setIsEvaluating(true);
      setEvaluationResult(null); // Clear previous broader results
      setNumPredictedRecords(null); // Clear previous specific metrics
      setNumHallucination(null); // Clear previous specific metrics

      try {
        const textMapFlatForEval = processedData.textMapFlat as Record<
          string,
          string
        >;
        const localNumPredictedRecords = predictXpathList.length;
        const mappedPredRecords = mapResponseToFullXPath(
          textMapFlatForEval,
          predictXpathList,
        );
        let localNumHallucination = 0;
        for (const record of mappedPredRecords) {
          if (record.length === 0) {
            localNumHallucination += 1;
          }
        }
        setNumPredictedRecords(localNumPredictedRecords);
        setNumHallucination(localNumHallucination);
      } catch (evalError) {
        console.error('Error during evaluation:', evalError);
        setErrorMessage((prev) =>
          prev
            ? `${prev}\nError: Could not calculate evaluation metrics.`
            : 'Error: Could not calculate evaluation metrics.',
        );
        setEvaluationResult(null);
        setNumPredictedRecords(null); // Ensure clear on error
        setNumHallucination(null); // Ensure clear on error
      } finally {
        setIsEvaluating(false);
      }
    } else {
      // If any of the necessary data is missing, ensure evaluationResult is null
      // and not in evaluating state.
      if (evaluationResult !== null) setEvaluationResult(null);
      if (numPredictedRecords !== null) setNumPredictedRecords(null);
      if (numHallucination !== null) setNumHallucination(null);
      if (isEvaluating) setIsEvaluating(false);
    }
  }, [
    // groundTruthXpathList, // Removed
    predictXpathList,
    processedData?.textMapFlat,
    // evaluationResult, // Removed from deps as it's set by this effect
    // isEvaluating, // Removed from deps as it's set by this effect
  ]);

  const handleLoadSyntheticData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setProcessedData(null);
    setLlmResponseContent(null);
    setLlmResponseUsage(null);
    setLlmErrorMessage(null);
    setSelectedStage(null);
    setPredictXpathList(null);
    setEvaluationResult(null);

    const htmlPath = "/next-eval/sample.html";

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
      console.error(`Error loading synthetic data`, error);
      if (error instanceof Error) {
        setErrorMessage(
          `Error loading synthetic data: ${error.message}`,
        );
      } else {
        setErrorMessage(
          "An unknown error occurred while loading synthetic data",
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
        NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction
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
              disabled={isLoading}
              ref={fileInputRef}
            />
          </div>

          {/* Separator */}
          <div className="flex flex-col items-center justify-start pt-8">
            <span className="text-sm font-medium text-gray-500">
              Or
            </span>
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
              disabled={isLoading}
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
      {processedData && processedData.originalHtml && !isLoading ? (
        <section className="w-full p-6 border rounded-lg shadow-md bg-white mb-4 md:mb-0">
          <h2 className="text-xl font-semibold mb-4">Original HTML Content</h2>
          {processedData.originalHtmlLength !== undefined && (
            <p className="text-sm text-gray-600 mb-2">
              Length: {processedData.originalHtmlLength.toLocaleString()} characters
            </p>
          )}
          <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
            <pre className="text-sm whitespace-pre-wrap">
              {processedData.originalHtml}
            </pre>
          </div>
          <button
            type="button"
            onClick={() => {
              if (processedData.originalHtml) {
                handleDownload(
                  processedData.originalHtml,
                  'original_source.html',
                  'text/html',
                );
              }
            }}
            className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out"
            aria-label="Download original_source.html"
            disabled={!processedData.originalHtml}
          >
            Download Original HTML
          </button>
        </section>
      ) : (
        <>
          {/* Display Original HTML Content Section (if only this is available) */}
          {processedData && processedData.originalHtml && !isLoading && (
            <section className="mb-8 p-6 border rounded-lg shadow-md bg-white">
              <h2 className="text-xl font-semibold mb-4">Original HTML Content</h2>
              {processedData.originalHtmlLength !== undefined && (
                <p className="text-sm text-gray-600 mb-2">
                  Length: {processedData.originalHtmlLength.toLocaleString()} characters
                </p>
              )}
              <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
                <pre className="text-sm whitespace-pre-wrap">
                  {processedData.originalHtml}
                </pre>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (processedData.originalHtml) {
                    handleDownload(
                      processedData.originalHtml,
                      'original_source.html',
                      'text/html',
                    );
                  }
                }}
                className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out"
                aria-label="Download original_source.html"
                disabled={!processedData.originalHtml}
              >
                Download Original HTML
              </button>
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
              role="button"
              tabIndex={0}
              className={`p-4 border rounded-lg shadow cursor-pointer transition-all duration-200 text-left flex flex-col justify-between ${
                selectedStage === 'html'
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                  : 'bg-gray-50 hover:bg-blue-50'
              }`}
              onClick={() => setSelectedStage('html')}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedStage('html')}
              aria-label="Select Slimmed HTML stage"
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
              role="button"
              tabIndex={0}
              className={`p-4 border rounded-lg shadow cursor-pointer transition-all duration-200 text-left flex flex-col justify-between ${
                selectedStage === 'textMap'
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                  : 'bg-gray-50 hover:bg-blue-50'
              }`}
              onClick={() => setSelectedStage('textMap')}
              onKeyDown={(e) =>
                e.key === 'Enter' && setSelectedStage('textMap')
              }
              aria-label="Select Hierarchical JSON stage"
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
              role="button"
              tabIndex={0}
              className={`p-4 border rounded-lg shadow cursor-pointer transition-all duration-200 text-left flex flex-col justify-between ${
                selectedStage === 'textMapFlat'
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                  : 'bg-gray-50 hover:bg-blue-50'
              }`}
              onClick={() => setSelectedStage('textMapFlat')}
              onKeyDown={(e) =>
                e.key === 'Enter' && setSelectedStage('textMapFlat')
              }
              aria-label="Select Flat JSON stage"
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
        <section className="p-6 border rounded-lg shadow-md bg-white">
          <h2 className="text-xl font-semibold mb-4">
            LLM Interaction (Gemini 2.5 Pro)
          </h2>
          {!selectedStage ? (
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              Please select one of the processing stages above to interact with
              LLM.
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold">
                  Selected stage for LLM:{' '}
                  <span className="font-normal">
                    {selectedStage === 'html'
                      ? 'Slimmed HTML'
                      : selectedStage === 'textMap'
                        ? 'Hierarchical JSON (Nested text map)'
                        : 'Flat JSON (text map)'}
                  </span>
                </p>
              </div>
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleSendToLlm}
                  aria-label="Send prompt to LLM"
                  className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedStage || isLlmLoading}
                >
                  {isLlmLoading ? 'Sending...' : 'Send to Gemini'}
                </button>
                <button
                  type="button"
                  aria-label="Clear selection"
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  onClick={() => {
                    setSelectedStage(null);
                  }}
                >
                  Clear Selection
                </button>
              </div>
            </>
          )}
          {/* Display LLM Response */}
          {isLlmLoading && (
            <div className="mt-6 text-center">
              <p className="text-lg font-semibold animate-pulse">
                Waiting for LLM response...
              </p>
              {/* You could add a more specific LLM loading spinner here */}
            </div>
          )}
          {llmErrorMessage && (
            <div
              className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
              role="alert"
            >
              <p className="font-semibold">LLM Error:</p>
              <pre className="text-sm whitespace-pre-wrap">
                {llmErrorMessage}
              </pre>
            </div>
          )}
          {llmResponseContent && !isLlmLoading && !llmErrorMessage && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">LLM Response:</h3>
              <>
                {llmResponseUsage && (
                  <div className="mb-4">
                    <h4 className="text-md font-semibold mb-1 text-gray-700">
                      Usage:
                    </h4>
                    <div className="max-h-48 overflow-auto bg-gray-50 p-3 border rounded-md">
                      <pre className="text-sm whitespace-pre-wrap">
                        {typeof llmResponseUsage === 'string'
                          ? llmResponseUsage
                          : JSON.stringify(llmResponseUsage, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-md font-semibold mb-1 text-gray-700">
                    Content:
                  </h4>
                  <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md">
                    <pre className="text-sm whitespace-pre-wrap">
                      {llmResponseContent}
                    </pre>
                  </div>
                </div>
              </>
            </div>
          )}
          {/* Display Evaluation Metrics from LLM Response */}
          {!isLlmLoading && !llmErrorMessage && predictXpathList && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">
                Evaluation Metrics (from LLM Response):
              </h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                {numPredictedRecords !== null && (
                  <p className="text-sm">
                    <span className="font-semibold">
                      Number of Predicted XPath Records:
                    </span>{' '}
                    {numPredictedRecords}
                  </p>
                )}
                {numHallucination !== null && (
                  <p className="text-sm">
                    <span className="font-semibold">
                      Number of Potential Hallucinations (empty mappings):
                    </span>{' '}
                    {numHallucination} (Rate:{' '}
                    {numPredictedRecords && numPredictedRecords > 0
                      ? `${((numHallucination / numPredictedRecords) * 100).toFixed(2)}%`
                      : 'N/A'}
                    )
                  </p>
                )}
                {(numPredictedRecords === null || numHallucination === null) &&
                  !isEvaluating && (
                    <p className="text-sm text-gray-500">
                      Evaluation metrics are being calculated or are not available.
                    </p>
                  )}
                {isEvaluating && (
                  <p className="text-sm text-blue-500 animate-pulse">
                    Calculating evaluation metrics...
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

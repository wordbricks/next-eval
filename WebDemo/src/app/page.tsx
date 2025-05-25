'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import EvaluationDisplay from '../components/EvaluationDisplay';
import type { HtmlResult } from '../lib/interfaces';
import type { TextMapNode } from '../lib/utils/TextMapNode';
import {
  type EvaluationResult,
  calculateEvaluationMetrics,
  mapResponseToFullXPath,
} from '../lib/utils/evaluation';
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
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [isLlmLoading, setIsLlmLoading] = useState<boolean>(false);
  const [llmErrorMessage, setLlmErrorMessage] = useState<string | null>(null);
  const [groundTruthXpathList, setGroundTruthXpathList] =
    useState<ValidatedXpathArray | null>(null);
  const [predictXpathList, setPredictXpathList] =
    useState<ValidatedXpathArray | null>(null);
  const [rawGroundTruthRecords, setRawGroundTruthRecords] = useState<
    string[][] | null
  >(null);
  const [rawPredictRecords, setRawPredictRecords] = useState<string[][] | null>(
    null,
  );
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [rawGroundTruthJsonContent, setRawGroundTruthJsonContent] = useState<
    string | null
  >(null);
  const [selectedSyntheticIndex, setSelectedSyntheticIndex] =
    useState<string>('');
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
      setSelectedSyntheticIndex(''); // Reset synthetic data selection
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
    // Clear LLM related states
    setLlmResponse(null);
    setLlmErrorMessage(null);
    setSelectedStage(null);
    setGroundTruthXpathList(null); // Reset ground truth for user-uploaded file
    setPredictXpathList(null); // Reset predictions for user-uploaded file
    setRawGroundTruthRecords(null);
    setRawPredictRecords(null);
    setEvaluationResult(null);
    setRawGroundTruthJsonContent(null); // Reset raw ground truth JSON content for user-uploaded file

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
    setLlmResponse(null); // Clear previous response
    setPredictXpathList(null); // Clear previous LLM-generated XPaths
    setRawPredictRecords(null); // Clear previous raw LLM XPaths
    setEvaluationResult(null); // Clear previous evaluation

    try {
      const promptTypeMap = {
        html: 'slim',
        textMapFlat: 'flat',
        textMap: 'hierarchical',
      } as const;

      // Prepare data: use stringified version for maps, direct HTML for 'html' stage
      let dataToSend: string | Record<string, string> | TextMapNode | undefined;
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
      const rawLlmOutput = result.llmResponse; // Assuming this is the direct string output for XPaths

      setLlmResponse(rawLlmOutput || JSON.stringify(result, null, 2));

      // Attempt to parse and validate the rawLlmOutput if it's a string intended to be XPaths
      if (rawLlmOutput && typeof rawLlmOutput === 'string') {
        const validatedPredXPaths = parseAndValidateXPaths(rawLlmOutput);
        if (validatedPredXPaths) {
          setPredictXpathList(validatedPredXPaths);
          // Attempt to parse rawLlmOutput as string[][] for evaluation
          try {
            const parsedRecords = JSON.parse(rawLlmOutput);
            if (
              Array.isArray(parsedRecords) &&
              parsedRecords.every(
                (record) =>
                  Array.isArray(record) &&
                  record.every((item) => typeof item === 'string'),
              )
            ) {
              setRawPredictRecords(parsedRecords as string[][]);
            } else {
              console.warn(
                'LLM response (rawLlmOutput) is not in string[][] format after parsing JSON.',
              );
              setRawPredictRecords(null);
            }
          } catch (e) {
            console.warn(
              'Failed to parse rawLlmOutput as JSON for raw records:',
              e,
            );
            setRawPredictRecords(null);
          }
        } else {
          setPredictXpathList(null);
          setRawPredictRecords(null);
          console.warn(
            'LLM response (rawLlmOutput) could not be validated as XPath list.',
          );
          // Optionally, extend llmErrorMessage or set a specific message
          setLlmErrorMessage((prev) =>
            prev
              ? `${prev}\nInfo: LLM output was not in the expected XPath list format.`
              : 'Info: LLM output was not in the expected XPath list format.',
          );
        }
      } else {
        setPredictXpathList(null);
        setRawPredictRecords(null);
        if (rawLlmOutput) {
          // It exists but it's not a string
          console.warn(
            'LLM response (rawLlmOutput) is not a string, cannot parse as XPaths directly.',
          );
        }
      }
      console.log('predictXpathList', predictXpathList);
    } catch (error) {
      console.error('Error sending to LLM:', error);
      setPredictXpathList(null); // Ensure reset on error
      setRawPredictRecords(null); // Ensure reset on error
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
      rawGroundTruthRecords &&
      rawPredictRecords &&
      processedData?.textMapFlat
    ) {
      setIsEvaluating(true);
      setEvaluationResult(null); // Clear previous results

      try {
        const textMapFlatForEval = processedData.textMapFlat as Record<
          string,
          string
        >;

        const mappedGtRecords = mapResponseToFullXPath(
          textMapFlatForEval,
          rawGroundTruthRecords,
        );
        const mappedPredRecords = mapResponseToFullXPath(
          textMapFlatForEval,
          rawPredictRecords,
        );

        // TODO: The calculateEvaluationMetrics currently returns dummy data.
        // You'll need to implement the actual logic in src/lib/utils/evaluation.ts
        const metrics = calculateEvaluationMetrics(
          mappedPredRecords,
          mappedGtRecords,
        );
        setEvaluationResult(metrics);
      } catch (evalError) {
        console.error('Error during evaluation:', evalError);
        setErrorMessage((prev) =>
          prev
            ? `${prev}\nError: Could not calculate evaluation metrics.`
            : 'Error: Could not calculate evaluation metrics.',
        );
        setEvaluationResult(null);
      } finally {
        setIsEvaluating(false);
      }
    } else {
      // If any of the necessary data is missing, ensure evaluationResult is null
      // and not in evaluating state.
      // This handles cases where one of the lists becomes null later.
      if (evaluationResult !== null) setEvaluationResult(null);
      if (isEvaluating) setIsEvaluating(false);
    }
  }, [
    rawGroundTruthRecords,
    rawPredictRecords,
    processedData?.textMapFlat,
    evaluationResult,
    isEvaluating,
  ]);

  // useEffect to automatically load synthetic data when index changes
  useEffect(() => {
    if (selectedSyntheticIndex && selectedSyntheticIndex !== '') {
      handleLoadSyntheticData();
    }
    // Adding handleLoadSyntheticData to dependency array if it's stable or wrapped in useCallback
    // For now, assuming it's stable or its dependencies are correctly managed.
    // If handleLoadSyntheticData itself causes state changes that re-trigger this effect
    // unintentionally, it might need to be wrapped in useCallback or its own dependencies reviewed.
  }, [selectedSyntheticIndex]); // Consider adding handleLoadSyntheticData if it's memoized

  const handleLoadSyntheticData = async () => {
    // Debounce or ensure it's not called excessively if selectedSyntheticIndex changes rapidly
    // For a select dropdown, this is usually fine.
    if (!selectedSyntheticIndex) {
      // This case might occur if the effect runs when selectedSyntheticIndex is reset to ''
      // We can choose to clear data or do nothing.
      // For now, let's ensure we only proceed if an index is actually selected.
      // The validation inside handleLoadSyntheticData will also catch empty/invalid index if it proceeds.
      return;
    }

    const index = parseInt(selectedSyntheticIndex, 10);
    if (isNaN(index) || index < 1 || index > 164) {
      setErrorMessage(
        'Invalid index. Please enter a number between 1 and 164.',
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProcessedData(null);
    setLlmResponse(null);
    setLlmErrorMessage(null);
    setSelectedStage(null);
    setGroundTruthXpathList(null);
    setPredictXpathList(null);
    setRawGroundTruthRecords(null);
    setRawPredictRecords(null);
    setEvaluationResult(null);
    setRawGroundTruthJsonContent(null);

    const htmlPath = `/next-eval/synthetic/html/${index}.html`;
    const groundTruthPath = `/next-eval/synthetic/groundTruth/${index}.json`;

    try {
      // Fetch and process HTML
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

      // Fetch and process groundTruth.json
      try {
        const groundTruthResponse = await fetch(groundTruthPath);
        if (!groundTruthResponse.ok) {
          console.error(
            `Failed to fetch ${groundTruthPath}: ${groundTruthResponse.status} ${groundTruthResponse.statusText}`,
          );
          setErrorMessage((prev) =>
            prev
              ? `${prev}\nWarning: Could not load ground truth XPaths for index ${index}.`
              : `Warning: Could not load ground truth XPaths for index ${index}.`,
          );
          setGroundTruthXpathList(null);
          setRawGroundTruthRecords(null);
          setRawGroundTruthJsonContent(null);
        } else {
          const groundTruthContent = await groundTruthResponse.text();
          setRawGroundTruthJsonContent(groundTruthContent);
          const validatedGroundTruth =
            parseAndValidateXPaths(groundTruthContent);
          if (validatedGroundTruth) {
            setGroundTruthXpathList(validatedGroundTruth);
            try {
              const parsedRecords = JSON.parse(groundTruthContent);
              if (
                Array.isArray(parsedRecords) &&
                parsedRecords.every(
                  (record) =>
                    Array.isArray(record) &&
                    record.every((item) => typeof item === 'string'),
                )
              ) {
                setRawGroundTruthRecords(parsedRecords as string[][]);
              } else {
                console.warn(
                  `Ground truth content from ${groundTruthPath} is not in string[][] format after parsing JSON.`,
                );
                setRawGroundTruthRecords(null);
              }
            } catch (e) {
              console.warn(
                `Failed to parse groundTruthContent from ${groundTruthPath} as JSON for raw records:`,
                e,
              );
              setRawGroundTruthRecords(null);
            }
          } else {
            console.warn(
              `Failed to parse or validate ${groundTruthPath}. Setting groundTruthXpathList to null.`,
            );
            setGroundTruthXpathList(null);
            setRawGroundTruthRecords(null);
            setRawGroundTruthJsonContent(null);
            setErrorMessage((prev) =>
              prev
                ? `${prev}\nWarning: Ground truth XPaths for index ${index} are invalid or empty.`
                : `Warning: Ground truth XPaths for index ${index} are invalid or empty.`,
            );
          }
        }
      } catch (gtError) {
        console.error(
          `Error loading or processing ${groundTruthPath}:`,
          gtError,
        );
        setGroundTruthXpathList(null);
        setRawGroundTruthRecords(null);
        setRawGroundTruthJsonContent(null);
        setErrorMessage((prev) =>
          prev
            ? `${prev}\nError: Could not load ground truth XPaths for index ${index}.`
            : `Error: Could not load ground truth XPaths for index ${index}.`,
        );
      }
    } catch (error) {
      console.error(`Error loading synthetic data for index ${index}:`, error);
      if (error instanceof Error) {
        setErrorMessage(
          `Error loading synthetic data for index ${index}: ${error.message}`,
        );
      } else {
        setErrorMessage(
          `An unknown error occurred while loading synthetic data for index ${index}.`,
        );
      }
      // Clear partial data on main error
      setProcessedData(null);
      setRawGroundTruthJsonContent(null);
      setGroundTruthXpathList(null);
      setRawGroundTruthRecords(null);
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
        <h2 className="text-xl font-semibold mb-4">Upload HTML or Load Synthetic Data</h2>
        <div className="flex flex-col md:flex-row md:space-x-6 md:space-y-0 space-y-6">
          {/* Option 1: Upload your own HTML file */}
          <div className="md:w-1/2 flex flex-col">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Option 1: Upload your own HTML file.
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

          {/* Option 2: Load Synthetic Data by Index */}
          <div className="md:w-1/2 flex flex-col md:border-l md:pl-6 border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Option 2: Load synthetic data by index (1-164).
            </p>
            <label
              htmlFor="syntheticIndexSelect"
              className="block text-sm font-medium text-gray-700 mb-1 sr-only"
            >
              Select Synthetic Data:
            </label>
            <select
              id="syntheticIndexSelect"
              name="syntheticIndexSelect"
              value={selectedSyntheticIndex}
              onChange={(e) => {
                const newSyntheticIndex = e.target.value;
                setSelectedSyntheticIndex(newSyntheticIndex);
                if (newSyntheticIndex) {
                  // If a synthetic option is chosen (not the default "-- Select --")
                  setSelectedFile(null); // Clear the selected file state
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''; // Clear the file input visually
                  }
                }
              }}
              className="block w-full text-sm text-slate-500 border-gray-300 rounded-md shadow-sm
                         focus:ring-indigo-500 focus:border-indigo-500
                         p-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              disabled={isLoading}
              aria-label="Select synthetic data by index (1-164)"
            >
              <option value="">-- Select Synthetic Data --</option>
              {Array.from({ length: 164 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Synthetic {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
        {errorMessage && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            Error: {errorMessage}
          </p>
        )}
      </section>

      {/* Conditional rendering for side-by-side or individual display */}
      {processedData && processedData.originalHtml && rawGroundTruthJsonContent && !isLoading ? (
        <div className="flex flex-col md:flex-row md:space-x-4 mb-8">
          <section className="w-full md:w-1/2 p-6 border rounded-lg shadow-md bg-white mb-4 md:mb-0">
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

          <section className="w-full md:w-1/2 p-6 border rounded-lg shadow-md bg-white">
            <h2 className="text-xl font-semibold mb-4">
              Ground Truth XPaths (JSON)
            </h2>
            <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
              <pre className="text-sm whitespace-pre-wrap">
                {rawGroundTruthJsonContent}
              </pre>
            </div>
            <button
              type="button"
              onClick={() =>
                handleDownload(
                  rawGroundTruthJsonContent,
                  'ground_truth.json',
                  'application/json',
                )
              }
              className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out"
              aria-label="Download ground_truth.json"
            >
              Download ground_truth.json
            </button>
          </section>
        </div>
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

          {/* Display Ground Truth JSON Section (if only this is available) */}
          {rawGroundTruthJsonContent && !isLoading && (
            <section className="mb-8 p-6 border rounded-lg shadow-md bg-white">
              <h2 className="text-xl font-semibold mb-4">
                Ground Truth XPaths (JSON)
              </h2>
              <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md mb-4">
                <pre className="text-sm whitespace-pre-wrap">
                  {rawGroundTruthJsonContent}
                </pre>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleDownload(
                    rawGroundTruthJsonContent,
                    'ground_truth.json',
                    'application/json',
                  )
                }
                className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded hover:bg-indigo-600 transition-colors duration-150 ease-in-out"
                aria-label="Download ground_truth.json"
              >
                Download ground_truth.json
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
          {llmResponse && !isLlmLoading && !llmErrorMessage && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">LLM Response:</h3>
              {(() => {
                try {
                  const parsed = JSON.parse(llmResponse);
                  if (
                    parsed &&
                    typeof parsed === 'object' &&
                    'content' in parsed &&
                    'usage' in parsed
                  ) {
                    return (
                      <>
                        <div className="mb-4">
                          <h4 className="text-md font-semibold mb-1 text-gray-700">
                            Usage:
                          </h4>
                          <div className="max-h-48 overflow-auto bg-gray-50 p-3 border rounded-md">
                            <pre className="text-sm whitespace-pre-wrap">
                              {typeof parsed.usage === 'string'
                                ? parsed.usage
                                : JSON.stringify(parsed.usage, null, 2)}
                            </pre>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-md font-semibold mb-1 text-gray-700">
                            Content:
                          </h4>
                          <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md">
                            <pre className="text-sm whitespace-pre-wrap">
                              {typeof parsed.content === 'string'
                                ? parsed.content
                                : JSON.stringify(parsed.content, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </>
                    );
                  }
                } catch (e) {
                  console.warn(
                    'LLM response is not a parseable JSON or not in the expected format for splitting. Displaying raw response:',
                    e,
                  );
                }
                return (
                  <div className="h-96 overflow-auto bg-gray-50 p-3 border rounded-md">
                    <pre className="text-sm whitespace-pre-wrap">
                      {llmResponse}
                    </pre>
                  </div>
                );
              })()}
            </div>
          )}
        </section>
      )}
      {processedData &&
        !isLoading &&
        groundTruthXpathList &&
        predictXpathList && (
          <EvaluationDisplay
            evaluationResult={evaluationResult}
            isLoading={isEvaluating}
          />
        )}
    </main>
  );
}

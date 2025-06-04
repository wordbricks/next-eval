'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { HtmlResult } from '../lib/interfaces';
import { mapResponseToFullXPath } from '../lib/utils/mapResponseToFullXpath';
import { processHtmlContent } from '../lib/utils/processHtmlContent';
import { readFileAsText } from '../lib/utils/readFileAsText';
import { runMDR } from '../lib/utils/runMDR';
import {
  type ValidatedXpathArray,
  parseAndValidateXPaths,
} from '../lib/utils/xpathValidation';
import FileUploadSection from './components/FileUploadSection';
import LlmTabContent from './components/LlmTabContent';
import MdrTabContent from './components/MdrTabContent';
import {
  type ExtractTab,
  type LlmAllResponses,
  type MdrResponseState,
  initialLlmStageResponse,
  initialMdrResponseState,
} from './types';

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For file processing
  const [processedData, setProcessedData] = useState<HtmlResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For file processing errors
  const [selectedStage, setSelectedStage] =
    useState<keyof LlmAllResponses>('textMapFlat');
  const [randomNumber, setRandomNumber] = useState<number | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [htmlId, setHtmlId] = useState<string | null>(null);

  // New state for UI tabs in extraction section
  const [activeExtractTab, setActiveExtractTab] = useState<ExtractTab>('llm');
  // New state for LLM model selection (though only one is enabled for now)
  const [selectedLlmModel, setSelectedLlmModel] =
    useState<string>('gemini-2.5-pro');
  const [copySuccess, setCopySuccess] = useState<string>('');

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


  const saveHtmlToServer = async (id: string, content: string) => {
    try {
      const response = await fetch('/next-eval/api/save-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlId: id, htmlContent: content }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Failed to save HTML and could not parse error.',
        }));
        console.error('Failed to save HTML to server:', errorData.message);
      } else {
        console.log('HTML saved to server successfully.');
      }
    } catch (error) {
      console.error('Error calling save-html API:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setRandomNumber(null);
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
      const newHtmlId = uuidv4();
      setHtmlId(newHtmlId);
      await saveHtmlToServer(newHtmlId, htmlString);
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
      promptTypeForLlm = 'hier';
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
        data: JSON.stringify(stageDataForLlm, null, 2),
        randomNumber,
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
      const mdrPredictedXPaths = runMDR(processedData.html);

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
      const mdrFullXPaths = mapResponseToFullXPath(
        textMapFlatForEval,
        validatedMdrXPaths,
      );

      const mappedText = mdrFullXPaths
        .filter((xpathArray) =>
          xpathArray.some((xpath) => xpath in textMapFlatForEval),
        )
        .map((xpathArray) =>
          xpathArray
            .filter((xpath) => xpath in textMapFlatForEval)
            .map((xpath) => textMapFlatForEval[xpath])
            .join(','),
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
              xpathArray.map((xpath) => textMapFlatForEval[xpath]).join(', '),
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
  }, [processedData?.textMapFlat, llmResponses]);

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

    const newRandomNumber = Math.floor(Math.random() * 20) + 1; // Generate number between 1 and 20
    setRandomNumber(newRandomNumber); // Set the randomNumber state
    const htmlPath = `/next-eval/sample${newRandomNumber}.html`; // Use newRandomNumber for the path

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
      const newHtmlId = uuidv4(); // Generate ID here
      setHtmlId(newHtmlId); // Set ID here
      await saveHtmlToServer(newHtmlId, htmlString); // Save to server
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

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopySuccess('Failed to copy');
    }
  };

  const getCurrentFeedbackId = () => {
    return `${htmlId}-${activeExtractTab === 'llm' ? selectedStage : 'mdr'}`;
  };

  const handleFeedback = async (isPositive: boolean) => {
    const id = getCurrentFeedbackId();
    if (feedbackSent[id]) {
      return; // Prevent multiple feedback for the same text
    }

    const feedbackMessage = `*Extraction Feedback*\\n${isPositive ? '👍' : '👎'} ID: ${id}`;

    try {
      const response = await fetch('/next-eval/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: feedbackMessage }),
      });

      if (response.ok) {
        setFeedbackSent((prev) => ({ ...prev, [id]: true }));
      } else {
        console.error(
          'Failed to send feedback via API. Status:',
          response.status,
        );
        const responseBody = await response.text();
        console.error('Response body:', responseBody);
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-[1000px]">
      <h1 className="text-3xl font-bold text-center my-8">
        NEXT-EVAL: Web Data Records Extraction
      </h1>
      {/* File Upload Section */}
      <FileUploadSection
        selectedFile={selectedFile}
        isLoading={isLoading}
        processedData={processedData}
        errorMessage={errorMessage}
        selectedStage={selectedStage}
        overallLlmFetching={overallLlmFetching}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onLoadSyntheticData={handleLoadSyntheticData}
        onStageSelect={setSelectedStage}
      />

      {/* Data Extraction Section */}
      {processedData && !isLoading && (
        <section className="mt-8 p-6 border rounded-lg shadow-md bg-white">
          <h2 className="text-2xl font-semibold mb-4">
            2. Extract data records
          </h2>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveExtractTab('llm')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                  ${
                    activeExtractTab === 'llm'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } focus:outline-none`}
                aria-current={activeExtractTab === 'llm' ? 'page' : undefined}
              >
                LLM
              </button>
              <button
                type="button"
                onClick={() => setActiveExtractTab('mdr')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                  ${
                    activeExtractTab === 'mdr'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } focus:outline-none`}
                aria-current={activeExtractTab === 'mdr' ? 'page' : undefined}
              >
                MDR Algorithm
              </button>
            </nav>
          </div>
          {/* LLM Tab Content */}
          {activeExtractTab === 'llm' && (
            <LlmTabContent
              processedData={processedData}
              selectedStage={selectedStage}
              selectedLlmModel={selectedLlmModel}
              llmResponses={llmResponses}
              overallLlmFetching={overallLlmFetching}
              mdrIsLoading={mdrResponse.isLoading}
              randomNumber={randomNumber}
              feedbackSent={feedbackSent}
              copySuccess={copySuccess}
              onStageChange={setSelectedStage}
              onModelChange={setSelectedLlmModel}
              onSendToLlm={handleSendToLlm}
              onFeedback={handleFeedback}
              onCopyToClipboard={handleCopyToClipboard}
              getCurrentFeedbackId={getCurrentFeedbackId}
            />
          )}
          {/* MDR Tab Content */}
          {activeExtractTab === 'mdr' && (
            <MdrTabContent
              processedData={processedData}
              mdrResponse={mdrResponse}
              overallLlmFetching={overallLlmFetching}
              isLoading={isLoading}
              feedbackSent={feedbackSent}
              copySuccess={copySuccess}
              onRunMdr={handleRunMdr}
              onFeedback={handleFeedback}
              onCopyToClipboard={handleCopyToClipboard}
              getCurrentFeedbackId={getCurrentFeedbackId}
            />
          )}
        </section>
      )}
    </main>
  );
}

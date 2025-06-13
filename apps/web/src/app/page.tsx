"use client";

import CopyIcon from "@/components/icons/CopyIcon";
import DownloadIcon from "@/components/icons/DownloadIcon";
import ThumbsDownIcon from "@/components/icons/ThumbsDownIcon";
import ThumbsUpIcon from "@/components/icons/ThumbsUpIcon";
import type { HtmlResult } from "@/lib/interfaces";
import { handleDownload } from "@/lib/utils/handleDownload";
import { processHtmlContent } from "@/lib/utils/processHtmlContent";
import { readFileAsText } from "@/lib/utils/readFileAsText";
import { runMDR } from "@/lib/utils/runMDR";
import {
  type ValidatedXpathArray,
  parseAndValidateXPaths,
} from "@/lib/utils/xpathValidation";
// import { calculateEvaluationMetrics } from '@/lib/utils/evaluation';
import { mapResponseToFullXPath } from "@next-eval/shared/utils";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface LlmStageResponse {
  content: string | null;
  usage: string | null;
  error: string | null;
  predictXpathList: ValidatedXpathArray | null;
  numPredictedRecords: number | null;
  numHallucination: number | null;
  mappedPredictionText: string[] | null;
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

interface LlmAllResponses {
  html: LlmStageResponse;
  textMap: LlmStageResponse;
  textMapFlat: LlmStageResponse;
}

type ExtractTab = "llm" | "mdr";

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

// Helper function for timeout
const timeoutPromise = <T,>(
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

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For file processing
  const [processedData, setProcessedData] = useState<HtmlResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For file processing errors
  const [selectedStage, setSelectedStage] =
    useState<keyof LlmAllResponses>("textMapFlat");
  const [randomNumber, setRandomNumber] = useState<number | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [htmlId, setHtmlId] = useState<string | null>(null);

  // New state for UI tabs in extraction section
  const [activeExtractTab, setActiveExtractTab] = useState<ExtractTab>("llm");
  // New state for LLM model selection (though only one is enabled for now)
  const [selectedLlmModel, setSelectedLlmModel] =
    useState<string>("gemini-2.5-pro");
  const [copySuccess, setCopySuccess] = useState<string>("");

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

  // Add new state for input method and URL input
  const [inputMethod, setInputMethod] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState<string>("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Move sampleUrls and handler inside the component
  const sampleUrls = [
    { label: "Product Hunt", value: "https://www.producthunt.com" },
    { label: "Fortune 500", value: "https://fortune.com/fortune500/" },
    {
      label: "Betalist/ai-tools",
      value: "https://betalist.com/topics/ai-tools",
    },
    {
      label: "Future Tools",
      value: "https://getgpt.app/marketplace/productivity",
    },
  ];

  const handleSampleUrlClick = (url: string) => {
    setUrlInput(url);
  };

  // useEffect(() => {
  //   if (processedData && !selectedStage) { // selectedStage is removed
  //     setSelectedStage("textMapFlat");
  //   }
  // }, [processedData, selectedStage]); // selectedStage removed

  const saveHtmlToServer = async (id: string, content: string) => {
    try {
      const response = await fetch("/next-eval/api/save-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlId: id, htmlContent: content }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: "Failed to save HTML and could not parse error.",
        }));
        console.error("Failed to save HTML to server:", errorData.message);
      } else {
        console.log("HTML saved to server successfully.");
      }
    } catch (error) {
      console.error("Error calling save-html API:", error);
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
      setSelectedStage("textMapFlat");
      setMdrResponse({ ...initialMdrResponseState }); // Reset MDR response
    } else {
      setSelectedFile(null);
    }
  };

  const handleProcessFile = useCallback(async () => {
    if (!selectedFile) {
      setErrorMessage("Please select an HTML file first.");
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
    setSelectedStage("textMapFlat");
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
      console.error("Client-side processing error:", error);
      if (error instanceof Error) {
        setErrorMessage(`Processing error: ${error.message}`);
      } else {
        setErrorMessage(
          "An unknown error occurred during client-side processing.",
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
      console.error("Processed data not available for LLM request.");
      // Optionally set a general error message for LLM section
      return;
    }
    if (!selectedStage) {
      // Ensure a stage is selected
      console.error("No stage selected for LLM request.");
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
  };

  const handleRunMdr = async () => {
    if (!processedData?.originalHtml || !processedData.textMapFlat) {
      console.error(
        "Original HTML or textMapFlat not available for MDR execution.",
      );
      setMdrResponse((prev) => ({
        ...prev,
        error:
          "Required data (original HTML or text map) is not processed yet.",
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
      const mdrPromise = runMDR(processedData.html);
      const mdrPredictedXPaths = await timeoutPromise(
        mdrPromise,
        60000, // 1 minute in milliseconds
        new Error("MDR processing timed out after 1 minute"),
      );

      if (!mdrPredictedXPaths || mdrPredictedXPaths.length === 0) {
        setMdrResponse((prev) => ({
          ...prev,
          predictXpathList: [],
          mappedPredictionText: [],
          numPredictedRecords: 0,
          isLoading: false,
          error: "MDR returned no XPaths.",
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
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error running MDR:", error);
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
            error: stageData.error?.includes("Evaluation Error:")
              ? stageData.error
                  .split("\n")
                  .filter((line) => !line.startsWith("Evaluation Error:"))
                  .join("\n") || null
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
                error: `${stageData.error ? `${stageData.error}\n` : ""}Evaluation Error: XPaths disappeared during evaluation. Resetting metrics.`,
              };
              updateScheduled = true;
              continue; // continue to next stageKey in forEach
            }

            const localNumPredictedRecords = stageData.predictXpathList.length;
            const mappedPredRecords = mapResponseToFullXPath(
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
    setSelectedStage("textMapFlat");
    setMdrResponse({ ...initialMdrResponseState }); // Reset MDR response

    const newRandomNumber = Math.floor(Math.random() * 20) + 1; // Generate number between 1 and 20
    setRandomNumber(newRandomNumber); // Set the randomNumber state
    const htmlPath = `/next-eval/samples/sample${newRandomNumber}.html`; // Use newRandomNumber for the path

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
      console.error("Error loading synthetic data", error);
      if (error instanceof Error) {
        setErrorMessage(`Error loading synthetic data: ${error.message}`);
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

  const getCurrentFeedbackId = () => {
    return `${htmlId}-${activeExtractTab === "llm" ? selectedStage : "mdr"}`;
  };

  const handleFeedback = async (isPositive: boolean) => {
    const id = getCurrentFeedbackId();
    if (feedbackSent[id]) {
      return; // Prevent multiple feedback for the same text
    }

    const feedbackMessage = `*Extraction Feedback*\\n${isPositive ? "👍" : "👎"} ID: ${id}`;

    try {
      const response = await fetch("/next-eval/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: feedbackMessage }),
      });

      if (response.ok) {
        setFeedbackSent((prev) => ({ ...prev, [id]: true }));
      } else {
        console.error(
          "Failed to send feedback via API. Status:",
          response.status,
        );
        const responseBody = await response.text();
        console.error("Response body:", responseBody);
      }
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  // Add handler for fetching and processing HTML from URL
  const handleFetchUrl = async () => {
    setUrlError(null);
    setRandomNumber(null);
    if (!urlInput.trim()) {
      setUrlError("Please enter a URL.");
      return;
    }
    if (!/^https?:\/\//i.test(urlInput.trim())) {
      setUrlError("URL must start with http:// or https://");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setProcessedData(null);
    setLlmResponses({
      html: { ...initialLlmStageResponse },
      textMap: { ...initialLlmStageResponse },
      textMapFlat: { ...initialLlmStageResponse },
    });
    setOverallLlmFetching(false);
    setSelectedStage("textMapFlat");
    setMdrResponse({ ...initialMdrResponseState });
    try {
      const response = await fetch("/next-eval/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error." }));
        throw new Error(
          errorData.error ||
            `Failed to fetch URL: ${response.status} ${response.statusText}`,
        );
      }
      const data = await response.json();
      const htmlString = data.html;
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
      console.error("Error fetching or processing URL:", error);
      setUrlError(
        error instanceof Error ? error.message : "Unknown error fetching URL.",
      );
      setProcessedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-[1000px] p-4">
      <h1 className="my-8 text-center font-bold text-3xl">
        NEXT-EVAL: Web Data Records Extraction
      </h1>
      {/* File Input Section */}
      <section className="mb-8 rounded-lg border bg-white p-6 shadow-md">
        <h2 className="mb-4 font-semibold text-2xl">
          1.Upload and process HTML
        </h2>
        {/* Toggle for input method */}
        <div
          className="mb-4 flex space-x-2"
          role="tablist"
          aria-label="Input method tabs"
        >
          <button
            type="button"
            className={`rounded-t-md px-4 py-2 font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-500 ${inputMethod === "file" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-orange-100"}`}
            aria-selected={inputMethod === "file"}
            aria-controls="file-upload-panel"
            id="file-upload-tab"
            tabIndex={0}
            onClick={() => setInputMethod("file")}
            onKeyDown={(e) => e.key === "Enter" && setInputMethod("file")}
          >
            Upload File
          </button>
          <button
            type="button"
            className={`rounded-t-md px-4 py-2 font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-500 ${inputMethod === "url" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-orange-100"}`}
            aria-selected={inputMethod === "url"}
            aria-controls="url-fetch-panel"
            id="url-fetch-tab"
            tabIndex={0}
            onClick={() => setInputMethod("url")}
            onKeyDown={(e) => e.key === "Enter" && setInputMethod("url")}
          >
            Fetch from URL
          </button>
        </div>
        {/* Input panels */}
        {inputMethod === "file" && (
          <div
            id="file-upload-panel"
            role="tabpanel"
            aria-labelledby="file-upload-tab"
            className="space-y-3"
          >
            {/* Main container for upload elements */}
            {/* Combined Upload and Load Sample section */}
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-700 text-sm">
                Upload your own HTML file.
              </p>
              <button
                type="button"
                onClick={handleLoadSyntheticData}
                className="rounded-md bg-orange-500 px-4 py-1.5 font-semibold text-white text-xs shadow-sm transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || overallLlmFetching}
                aria-label="Load sample HTML data"
              >
                Load sample
              </button>
            </div>
            <input
              type="file"
              aria-label="Upload HTML or MHTML file"
              className="block w-full rounded-md border border-gray-300 p-2 text-slate-500 text-sm shadow-sm file:mr-4 file:rounded-full file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:font-semibold file:text-orange-600 file:text-sm hover:file:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              accept=".html"
              onChange={handleFileChange}
              disabled={isLoading || overallLlmFetching}
              ref={fileInputRef}
            />
          </div>
        )}
        {inputMethod === "url" && (
          <div
            id="url-fetch-panel"
            role="tabpanel"
            aria-labelledby="url-fetch-tab"
            className="space-y-3"
          >
            {/* Sample URL buttons */}
            <div className="mb-2 flex flex-wrap gap-2">
              {sampleUrls.map((sample) => (
                <button
                  key={sample.value}
                  type="button"
                  className="rounded-md bg-orange-100 px-3 py-1 font-semibold text-orange-700 text-xs shadow-sm hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-label={`Fetch sample: ${sample.label}`}
                  tabIndex={0}
                  disabled={isLoading || overallLlmFetching}
                  onClick={() => handleSampleUrlClick(sample.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSampleUrlClick(sample.value)
                  }
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <label
              htmlFor="url-input"
              className="block font-medium text-gray-700 text-sm"
            >
              Enter a public web page URL to fetch HTML
            </label>
            <input
              id="url-input"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="https://example.com"
              aria-label="Web page URL"
              disabled={isLoading || overallLlmFetching}
              autoComplete="off"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFetchUrl}
                className="rounded-md bg-orange-500 px-4 py-1.5 font-semibold text-white text-xs shadow-sm transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || overallLlmFetching}
                aria-label="Fetch HTML from URL"
              >
                Fetch & Process
              </button>
              <button
                type="button"
                onClick={() => setUrlInput("")}
                className="px-2 py-1 text-gray-500 text-xs hover:text-orange-600 focus:outline-none"
                aria-label="Clear URL input"
                disabled={isLoading || overallLlmFetching}
              >
                Clear
              </button>
            </div>
            {urlError && (
              <p className="mt-2 text-red-600 text-sm" role="alert">
                Error: {urlError}
              </p>
            )}
          </div>
        )}
        {errorMessage && (
          <p className="mt-4 text-red-600 text-sm" role="alert">
            {" "}
            {/* Adjusted margin top */}
            Error: {errorMessage}
          </p>
        )}
        {/* Conditional rendering for side-by-side or individual display - MOVED HERE */}
        {processedData?.originalHtml && !isLoading ? (
          <div className="mt-8">
            <div className="flex w-full flex-col justify-between rounded-lg border bg-gray-50 p-4 text-left shadow">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-medium text-lg">Original HTML</h3>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      processedData.originalHtml,
                      "original_html.html",
                      "text/html",
                    )
                  }
                  className="rounded-full p-1 text-orange-500 transition-colors duration-150 ease-in-out hover:bg-orange-100 hover:text-orange-700"
                  aria-label="Download original HTML"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <div className="mb-3 h-32 overflow-auto rounded border bg-white p-2">
                  <pre className="whitespace-pre-wrap text-xs">
                    {processedData.originalHtml}
                  </pre>
                </div>
                <p className="text-right text-gray-500 text-xs">
                  {(processedData.originalHtmlLength ?? 0).toLocaleString()}{" "}
                  characters
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Display Original HTML Content Section (if only this is available) */}
            {processedData?.originalHtml && !isLoading && (
              <>
                <h2 className="mb-4 font-semibold text-xl">
                  Original HTML Content
                </h2>
                {processedData.originalHtmlLength !== undefined && (
                  <p className="mb-2 text-gray-600 text-sm">
                    {processedData.originalHtmlLength.toLocaleString()}{" "}
                    characters
                  </p>
                )}
                <div className="mb-4 h-96 overflow-auto rounded-md border bg-gray-50 p-3">
                  <pre className="whitespace-pre-wrap text-sm">
                    {processedData.originalHtml}
                  </pre>
                </div>
              </>
            )}
          </>
        )}

        {processedData && !isLoading && (
          <section className="my-8">
            {" "}
            {/* This section already has my-8 for spacing */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Stage 1: Slimmed HTML (Cleaned HTML) */}
              <div
                className={`flex cursor-pointer flex-col justify-between rounded-lg border bg-gray-50 p-4 text-left shadow transition-all duration-150 ease-in-out ${selectedStage === "html" ? "border-orange-500 ring-2 ring-orange-300" : "border-gray-200 hover:shadow-md"}`}
                onClick={() => setSelectedStage("html")}
                onKeyDown={(e) => e.key === "Enter" && setSelectedStage("html")}
                tabIndex={0}
                role="button"
                aria-pressed={selectedStage === "html"}
                aria-label="Select Slimmed HTML stage and view its content"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-lg">1. Slimmed HTML</h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent stage selection when clicking download
                      handleDownload(
                        processedData.html,
                        "slimmed_html.html",
                        "text/html",
                      );
                    }}
                    className="rounded-full p-1 text-orange-500 transition-colors duration-150 ease-in-out hover:bg-orange-100 hover:text-orange-700"
                    aria-label="Download slimmed HTML"
                  >
                    <DownloadIcon />
                  </button>
                </div>
                <div>
                  <div className="mb-3 h-32 overflow-auto rounded border bg-white p-2">
                    <pre className="whitespace-pre-wrap text-xs">
                      {processedData.html}
                    </pre>
                  </div>
                  <p className="text-right text-gray-500 text-xs">
                    {processedData.htmlLength.toLocaleString()} characters
                  </p>
                </div>
              </div>

              {/* Stage 2: Hierarchical JSON (Nested text map) */}
              <div
                className={`flex cursor-pointer flex-col justify-between rounded-lg border bg-gray-50 p-4 text-left shadow transition-all duration-150 ease-in-out ${selectedStage === "textMap" ? "border-orange-500 ring-2 ring-orange-300" : "border-gray-200 hover:shadow-md"}`}
                onClick={() => setSelectedStage("textMap")}
                onKeyDown={(e) =>
                  e.key === "Enter" && setSelectedStage("textMap")
                }
                tabIndex={0}
                role="button"
                aria-pressed={selectedStage === "textMap"}
                aria-label="Select Hierarchical JSON stage and view its content"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-lg">2. Hierarchical JSON</h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(
                        JSON.stringify(processedData.textMap, null, 2),
                        "hierarchical_map.json",
                        "application/json",
                      );
                    }}
                    className="rounded-full p-1 text-orange-500 transition-colors duration-150 ease-in-out hover:bg-orange-100 hover:text-orange-700"
                    aria-label="Download hierarchical JSON map"
                  >
                    <DownloadIcon />
                  </button>
                </div>
                <div>
                  <div className="mb-3 h-32 overflow-auto rounded border bg-white p-2">
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(processedData.textMap, null, 2)}
                    </pre>
                  </div>
                  <p className="text-right text-gray-500 text-xs">
                    {processedData.textMapLength.toLocaleString()} characters
                  </p>
                </div>
              </div>

              {/* Stage 3: Flat JSON (text map) */}
              <div
                className={`flex cursor-pointer flex-col justify-between rounded-lg border bg-gray-50 p-4 text-left shadow transition-all duration-150 ease-in-out ${selectedStage === "textMapFlat" ? "border-orange-500 ring-2 ring-orange-300" : "border-gray-200 hover:shadow-md"}`}
                onClick={() => setSelectedStage("textMapFlat")}
                onKeyDown={(e) =>
                  e.key === "Enter" && setSelectedStage("textMapFlat")
                }
                tabIndex={0}
                role="button"
                aria-pressed={selectedStage === "textMapFlat"}
                aria-label="Select Flat JSON stage and view its content"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-lg">3. Flat JSON</h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(
                        JSON.stringify(processedData.textMapFlat, null, 2),
                        "flat_map.json",
                        "application/json",
                      );
                    }}
                    className="rounded-full p-1 text-orange-500 transition-colors duration-150 ease-in-out hover:bg-orange-100 hover:text-orange-700"
                    aria-label="Download flat JSON map"
                  >
                    <DownloadIcon />
                  </button>
                </div>
                <div>
                  <div className="mb-3 h-32 overflow-auto rounded border bg-white p-2">
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(processedData.textMapFlat, null, 2)}
                    </pre>
                  </div>
                  <p className="text-right text-gray-500 text-xs">
                    {processedData.textMapFlatLength.toLocaleString()}{" "}
                    characters
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Loading Indicator - more prominent */}
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg bg-white p-6 shadow-xl">
              <p className="animate-pulse font-semibold text-lg">
                Processing file, please wait...
              </p>
              {/* You can add a spinner SVG or component here */}
            </div>
          </div>
        )}
      </section>

      {/* LLM Interaction Section */}
      {processedData && !isLoading && (
        <section className="mt-8 rounded-lg border bg-white p-6 shadow-md">
          <h2 className="mb-4 font-semibold text-2xl">
            2. Extract data records
          </h2>

          {/* Tab Navigation */}
          <div className="mb-6 border-gray-200 border-b">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveExtractTab("llm")}
                className={`whitespace-nowrap border-b-2 px-1 py-3 font-medium text-sm ${
                  activeExtractTab === "llm"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                } focus:outline-none`}
                aria-current={activeExtractTab === "llm" ? "page" : undefined}
              >
                LLM
              </button>
              <button
                type="button"
                onClick={() => setActiveExtractTab("mdr")}
                className={`whitespace-nowrap border-b-2 px-1 py-3 font-medium text-sm ${
                  activeExtractTab === "mdr"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                } focus:outline-none`}
                aria-current={activeExtractTab === "mdr" ? "page" : undefined}
              >
                MDR Algorithm
              </button>
            </nav>
          </div>
          {/* LLM Tab Content */}
          {activeExtractTab === "llm" && (
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
                    className="block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-sm"
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
                      overallLlmFetching ||
                      llmResponses[selectedStage]?.isLoading
                    }
                    className="block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-sm"
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
                  className="w-full rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white shadow-md transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  disabled={
                    !processedData ||
                    overallLlmFetching ||
                    !selectedStage ||
                    mdrResponse.isLoading ||
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
                  const stageTitles: Record<keyof LlmAllResponses, string> = {
                    html: "Slimmed HTML Response",
                    textMap: "Hierarchical JSON Response",
                    textMapFlat: "Flat JSON Response",
                  };
                  return (
                    <div
                      key={stageKey}
                      className="mt-4 flex flex-col rounded-lg border bg-gray-50 p-4 shadow-sm" // Added mt-4
                    >
                      <h3 className="mb-3 border-b pb-2 font-semibold text-gray-800 text-lg">
                        LLM Response
                      </h3>
                      {stageResponse.isLoading && (
                        <p className="animate-pulse font-medium text-blue-600 text-md">
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
                                        onClick={() => handleFeedback(true)}
                                        disabled={
                                          feedbackSent[getCurrentFeedbackId()]
                                        }
                                        className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-green-100 ${
                                          feedbackSent[getCurrentFeedbackId()]
                                            ? "text-green-600"
                                            : "text-gray-400 hover:text-green-600"
                                        }`}
                                        aria-label="Give positive feedback"
                                      >
                                        <ThumbsUpIcon />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFeedback(false)}
                                        disabled={
                                          feedbackSent[getCurrentFeedbackId()]
                                        }
                                        className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-red-100 ${
                                          feedbackSent[getCurrentFeedbackId()]
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
                                          <span className="-top-8 -translate-x-1/2 absolute left-1/2 transform rounded bg-gray-800 px-2 py-1 text-white text-xs">
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
                                  stageResponse.predictXpathList && ( // Metrics successfully calculated
                                    <>
                                      <p>
                                        <span className="font-semibold">
                                          Predicted Records:
                                        </span>{" "}
                                        {stageResponse.numPredictedRecords}
                                      </p>
                                      {stageResponse.numHallucination !==
                                        null && (
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
                                    "Evaluation Error:",
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
            </div>
          )}
          {/* MDR Tab Content */}
          {activeExtractTab === "mdr" && (
            <div className="mt-4">
              {" "}
              {/* Added mt-4 for spacing consistent with LLM tab */}
              {/* Run MDR Button */}
              <div className="mb-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleRunMdr}
                  aria-label="Run MDR Algorithm on Original HTML"
                  className="w-full rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white shadow-md transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  disabled={
                    !processedData?.originalHtml ||
                    mdrResponse.isLoading ||
                    overallLlmFetching
                  } // Simplified disabled condition
                >
                  {mdrResponse.isLoading
                    ? "Running MDR..."
                    : "Run MDR Algorithm"}
                </button>
              </div>
              {/* MDR Response Card */}
              {processedData &&
                !isLoading && ( // This outer check might be redundant if section is already conditional
                  <div className="flex flex-col rounded-lg border bg-gray-50 p-4 shadow-sm">
                    <h3 className="mb-3 border-b pb-2 font-semibold text-gray-800 text-lg">
                      MDR Algorithm Response
                    </h3>
                    {mdrResponse.isLoading && (
                      <p className="animate-pulse font-medium text-blue-600 text-md">
                        Processing with MDR, please wait...
                      </p>
                    )}
                    {mdrResponse.error && (
                      <div
                        className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm"
                        role="alert"
                      >
                        <p className="font-semibold">MDR Error:</p>
                        <pre className="whitespace-pre-wrap break-all">
                          {mdrResponse.error}
                        </pre>
                      </div>
                    )}
                    {!mdrResponse.isLoading &&
                      (mdrResponse.predictXpathList || mdrResponse.error) && // Ensure something to show or an error
                      !mdrResponse.error && ( // If no error, show data
                        <>
                          {mdrResponse.predictXpathList && (
                            <div className="mb-3">
                              <h4 className="mb-1 font-semibold text-gray-600 text-sm">
                                Predicted XPaths:
                              </h4>
                              <div className="h-48 overflow-auto rounded-md border bg-gray-100 p-2 text-xs">
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
                                <div className="mb-1 flex items-center justify-between">
                                  <h4 className="font-semibold text-gray-600 text-sm">
                                    Predicted Text:
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleFeedback(true)}
                                      disabled={
                                        feedbackSent[getCurrentFeedbackId()]
                                      }
                                      className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-green-100 ${
                                        feedbackSent[getCurrentFeedbackId()]
                                          ? "text-green-600"
                                          : "text-gray-400 hover:text-green-600"
                                      }`}
                                      aria-label="Give positive feedback"
                                    >
                                      <ThumbsUpIcon />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleFeedback(false)}
                                      disabled={
                                        feedbackSent[getCurrentFeedbackId()]
                                      }
                                      className={`rounded-full p-1 transition-colors duration-150 ease-in-out hover:bg-red-100 ${
                                        feedbackSent[getCurrentFeedbackId()]
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
                                          mdrResponse.mappedPredictionText?.join(
                                            "\n",
                                          ) || "",
                                        )
                                      }
                                      className="group relative rounded-full p-1 text-orange-500 transition-colors duration-150 ease-in-out hover:bg-orange-100 hover:text-orange-700"
                                      aria-label="Copy predicted text to clipboard"
                                    >
                                      <CopyIcon />
                                      {copySuccess && (
                                        <span className="-top-8 -translate-x-1/2 absolute left-1/2 transform rounded bg-gray-800 px-2 py-1 text-white text-xs">
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
                                  <span className="font-semibold">
                                    Predicted Records:
                                  </span>{" "}
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
                      !mdrResponse.error && ( // Initial state before running MDR
                        <p className="text-gray-500">Run MDR to see results.</p>
                      )}
                  </div>
                )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

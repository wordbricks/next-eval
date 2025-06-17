"use client";

import { handleDownload } from "@/app/utils/handleDownload";
import {
  htmlIdAtom,
  processedDataAtom,
  randomNumberAtom,
} from "@/atoms/shared";
import { ContactFooter } from "@/components/ContactFooter";
import { LlmInteractionSection } from "@/components/LlmInteractionSection";
import { PageHeader } from "@/components/PageHeader";
import DownloadIcon from "@/components/icons/DownloadIcon";
import { readFileAsText } from "@/lib/utils/readFileAsText";
import { processHtmlContent } from "@wordbricks/next-eval";
import { useAtom, useSetAtom } from "jotai";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For file processing
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For file processing errors

  // Use atoms for shared state
  const [processedData, setProcessedData] = useAtom(processedDataAtom);
  const setRandomNumber = useSetAtom(randomNumberAtom);
  const setHtmlId = useSetAtom(htmlIdAtom);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add new state for input method and URL input
  const [inputMethod, setInputMethod] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState<string>("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Move sampleUrls and handler inside the component
  const sampleUrls = [
    {
      label: "Campus Dining Menu",
      value: "https://dining.berkeley.edu/menus/",
    },
    {
      label: "Course Bulletin",
      value:
        "https://explorecourses.stanford.edu/search?view=catalog&filter-coursestatus-Active=on&page=0&catalog=&academicYear=&q=CS231&collapse=",
    },
    {
      label: "Scholarships List",
      value:
        "https://www.scholarships.com/financial-aid/college-scholarships/scholarship-directory/sat-score/sat-scores-from-1401-to-1600",
    },
    {
      label: "OECD Dashboard",
      value:
        "https://www.oecd.org/en/data/dashboards.html?orderBy=mostRelevant&page=0",
    },
    {
      label: "Pubmed Library",
      value:
        "https://pubmed.ncbi.nlm.nih.gov/?term=Digital+Twins+of+Human+Biology&filter=simsearch3.fft&size=50",
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

  useEffect(() => {
    if (selectedFile) {
      handleProcessFile();
    }
  }, [selectedFile, handleProcessFile]);

  const handleLoadSyntheticData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setProcessedData(null);

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
      <PageHeader />
      <section className="mb-8 rounded-lg border bg-white p-6 shadow-md">
        <h2 className="mb-4 font-semibold text-2xl">
          1.Upload and process HTML
        </h2>
        <p className="mb-6 text-gray-600">
          Upload an HTML file or enter a URL to process it into three
          formats—Slimmed HTML, Hierarchical JSON, or Flat JSON—then select one
          to begin your evaluation for the next step.
        </p>
        {/* Toggle for input method */}
        <div
          className="mb-4 flex space-x-2"
          role="tablist"
          aria-label="Input method tabs"
        >
          <button
            type="button"
            className={`rounded-t-md px-4 py-2 font-semibold transition-colors duration-150 focus:outline-hidden focus:ring-2 focus:ring-orange-500 ${inputMethod === "file" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-orange-100"}`}
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
            className={`rounded-t-md px-4 py-2 font-semibold transition-colors duration-150 focus:outline-hidden focus:ring-2 focus:ring-orange-500 ${inputMethod === "url" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-orange-100"}`}
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
                className="rounded-md bg-orange-500 px-4 py-1.5 font-semibold text-white text-xs shadow-xs transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                aria-label="Load sample HTML data"
              >
                Load sample
              </button>
            </div>
            <input
              type="file"
              aria-label="Upload HTML or MHTML file"
              className="block w-full rounded-md border border-gray-300 p-2 text-slate-500 text-sm shadow-xs file:mr-4 file:rounded-full file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:font-semibold file:text-orange-600 file:text-sm hover:file:bg-orange-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              accept=".html"
              onChange={handleFileChange}
              disabled={isLoading}
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
              className="block w-full rounded-md border border-gray-300 p-2 text-sm shadow-xs focus:border-orange-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              placeholder="https://example.com"
              aria-label="Web page URL"
              disabled={isLoading}
              autoComplete="off"
            />
            <div className="mb-2 flex flex-wrap gap-2">
              {sampleUrls.map((sample) => (
                <button
                  key={sample.value}
                  type="button"
                  className="rounded-md bg-orange-100 px-3 py-1 font-semibold text-orange-700 text-xs shadow-xs hover:bg-orange-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  aria-label={`Fetch sample: ${sample.label}`}
                  tabIndex={0}
                  disabled={isLoading}
                  onClick={() => handleSampleUrlClick(sample.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSampleUrlClick(sample.value)
                  }
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFetchUrl}
                className="rounded-md bg-orange-500 px-4 py-1.5 font-semibold text-white text-xs shadow-xs transition-colors duration-150 ease-in-out hover:bg-orange-600 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                aria-label="Fetch HTML from URL"
              >
                Fetch & Process
              </button>
              <button
                type="button"
                onClick={() => setUrlInput("")}
                className="px-2 py-1 text-gray-500 text-xs hover:text-orange-600 focus:outline-hidden"
                aria-label="Clear URL input"
                disabled={isLoading}
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
            <div className="flex w-full flex-col justify-between rounded-lg border bg-gray-50 p-4 text-left shadow-sm">
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
                <div className="mb-3 h-32 overflow-auto rounded-sm border bg-white p-2">
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
                className="flex cursor-pointer flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 text-left shadow-sm transition-all duration-150 ease-in-out hover:shadow-md"
                tabIndex={0}
                role="button"
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
                  <div className="mb-3 h-32 overflow-auto rounded-sm border bg-white p-2">
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
                className="flex cursor-pointer flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 text-left shadow-sm transition-all duration-150 ease-in-out hover:shadow-md"
                tabIndex={0}
                role="button"
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
                  <div className="mb-3 h-32 overflow-auto rounded-sm border bg-white p-2">
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
                className="flex cursor-pointer flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 text-left shadow-sm transition-all duration-150 ease-in-out hover:shadow-md"
                tabIndex={0}
                role="button"
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
                  <div className="mb-3 h-32 overflow-auto rounded-sm border bg-white p-2">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
        <LlmInteractionSection isLoading={isLoading} />
      )}

      {/* Contact Information Footer */}
      <ContactFooter />
    </main>
  );
}

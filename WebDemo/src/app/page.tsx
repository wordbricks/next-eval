'use client';

import React, { useState, useEffect } from 'react';
import type { HtmlResult } from '../lib/interfaces';

// Helper function to read file as text
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

// Helper function to generate a simple XPath for an element
const generateXPath = (element: Element | null): string => {
  if (!element) return '';
  // Prioritize id if present and it's reasonably simple (e.g., no spaces, not just a number)
  if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id)) return `id(\'${element.id}\')`;

  let path = '';
  let currentElement: Element | null = element;
  while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
    let siblingIndex = 1;
    let sibling = currentElement.previousElementSibling;
    while (sibling) {
      if (sibling.nodeName === currentElement.nodeName) {
        siblingIndex++;
      }
      sibling = sibling.previousElementSibling;
    }
    const tagName = currentElement.nodeName.toLowerCase();
    const segment = siblingIndex > 1 ? `[${siblingIndex}]` : '';
    path = `/${tagName}${segment}${path}`;
    currentElement = currentElement.parentElement;
  }
  // Remove leading /html if present to make paths relative to html's direct children (head, body)
  if (path.startsWith('/html/')) {
    return path.substring(5); // length of "/html"
  }
  return path || '/';
};

// Helper function to remove script, style tags, and comments from HTML
const slimHtml = (doc: Document): string => {
  // 1. Initial DOM-based removal of specific tags
  doc.querySelectorAll("script").forEach((el) => el.remove());
  doc.querySelectorAll("style").forEach((el) => el.remove());
  doc.querySelectorAll("meta").forEach((el) => {
    if (el.getAttribute("charset") === null) {
      el.remove();
    }
  });
  doc.querySelectorAll("link").forEach((el) => el.remove());

  // 2. Convert to string
  const htmlContent = doc.documentElement ? doc.documentElement.outerHTML : '';
  if (!htmlContent) {
    return ''; // Return empty if no content after initial cleaning
  }

  // Perform string-based cleaning (includes comment removal)
  const stringCleanedContent = htmlContent
    .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
    .replace(/\n\s*\n/g, "\n")       // Remove multiple consecutive line breaks
    .replace(/>\s+</g, "><")          // Remove whitespace between tags
    .replace(/\s+/g, " ")            // Replace multiple spaces with single space
    .trim();                         // Remove leading/trailing whitespace

  // 3. Create a new document from the string-cleaned content
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(stringCleanedContent, "text/html");

  // 4. Remove all attributes from all elements in the new document
  if (tempDoc.documentElement) {
    const elements = tempDoc.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const attributes = element.attributes;
      // Iterate backwards because attributes is a live collection
      for (let j = attributes.length - 1; j >= 0; j--) {
        const attr = attributes[j];
        element.removeAttribute(attr.name);
      }
    }
  }

  // 5. Return the final cleaned HTML
  return tempDoc.documentElement ? tempDoc.documentElement.outerHTML : '';
};

interface TextMapNode {
  [key: string]: string | TextMapNode;
}

// Helper function to extract text and build flat/hierarchical maps
const extractTextWithXPaths = (doc: Document): { textMapFlat: Record<string, string>, textMap: TextMapNode } => {
  const textMapFlat: Record<string, string> = {};
  const textMap: TextMapNode = {};
  const treeWalker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      // Only accept non-empty text nodes that are not inside <script> or <style>
      if (node.nodeValue && node.nodeValue.trim() !== '') {
        let parent = node.parentElement;
        while (parent) {
          if (['SCRIPT', 'STYLE'].includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_REJECT;
    }
  });

  let currentNode;
  while (currentNode = treeWalker.nextNode()) {
    const textContent = currentNode.nodeValue?.trim();
    if (textContent && currentNode.parentElement) {
      const xpath = generateXPath(currentNode.parentElement);
      textMapFlat[xpath] = textContent;

      // Build hierarchical map (simplified version)
      // This creates a nested object based on XPath segments.
      // A more robust solution might be needed for complex XPaths or specific structures.
      const parts = xpath.substring(1).split('/');
      let currentLevel = textMap;
      parts.forEach((part, index) => {
        const key = part.replace(/\W/g, '_'); // Sanitize part to be a valid key
        if (index === parts.length - 1) {
          currentLevel[key] = textContent;
        } else {
          if (!currentLevel[key] || typeof currentLevel[key] === 'string') {
            currentLevel[key] = {};
          }
          currentLevel = currentLevel[key] as TextMapNode;
        }
      });
    }
  }
  return { textMapFlat, textMap };
};

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processedData, setProcessedData] = useState<HtmlResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<'html' | 'textMapFlat' | 'textMap' | null>(null);
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [isLlmLoading, setIsLlmLoading] = useState<boolean>(false);
  const [llmErrorMessage, setLlmErrorMessage] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number>(0.7);

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

  const handleTemperatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTemperature(parseFloat(event.target.value));
  };

  const handleProcessFile = async () => {
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

    try {
      const htmlString = await readFileAsText(selectedFile);
      const originalHtmlLength = htmlString.length;
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');

      // 1. Slim the HTML
      const cleanedHtml = slimHtml(doc);
      const htmlLength = cleanedHtml.length;

      // We need to re-parse the cleaned HTML to ensure XPaths are generated from the modified structure
      const cleanedDoc = parser.parseFromString(cleanedHtml, 'text/html');

      // 2. Extract text and XPaths
      const { textMapFlat, textMap } = extractTextWithXPaths(cleanedDoc);

      const textMapFlatString = JSON.stringify(textMapFlat, null, 2);
      const textMapFlatLength = textMapFlatString.length;
      const textMapString = JSON.stringify(textMap, null, 2);
      const textMapLength = textMapString.length;

      setProcessedData({
        html: cleanedHtml,
        textMapFlat,
        textMap,
        originalHtmlLength,
        htmlLength,
        textMapFlatLength,
        textMapLength,
      });

    } catch (error) {
      console.error('Client-side processing error:', error);
      if (error instanceof Error) {
        setErrorMessage(`Processing error: ${error.message}`);
      } else {
        setErrorMessage('An unknown error occurred during client-side processing.');
      }
      setProcessedData(null); // Clear any partial data
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToLlm = async () => {
    if (!selectedStage || !processedData) {
      setLlmErrorMessage("Please select a processing stage and ensure data is available.");
      return;
    }

    setIsLlmLoading(true);
    setLlmErrorMessage(null);
    setLlmResponse(null); // Clear previous response

    try {
      const promptTypeMap = {
        html: 'slim',
        textMapFlat: 'flat',
        textMap: 'hierarchical',
      } as const;

      // Prepare data: use stringified version for maps, direct HTML for 'html' stage
      let dataToSend;
      if (selectedStage === 'html') {
        dataToSend = processedData.html;
      } else if (selectedStage === 'textMapFlat') {
        dataToSend = processedData.textMapFlat; // Send the object, not stringified
      } else if (selectedStage === 'textMap') {
        dataToSend = processedData.textMap; // Send the object, not stringified
      } else {
        throw new Error("Invalid stage selected for LLM interaction");
      }
      
      const requestBody = {
        promptType: promptTypeMap[selectedStage as keyof typeof promptTypeMap],
        data: dataToSend,
        temperature: temperature,
      };

      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to get response from LLM and could not parse error.' }));
        throw new Error(errorData.message || `LLM API request failed with status ${response.status}`);
      }

      const result = await response.json();
      // Assuming the LLM response is in a specific part of the result, e.g., result.llmResponse
      // Adjust this based on your actual API response structure
      setLlmResponse(result.llmResponse || JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error sending to LLM:', error);
      if (error instanceof Error) {
        setLlmErrorMessage(`LLM Error: ${error.message}`);
      } else {
        setLlmErrorMessage('An unknown error occurred while contacting the LLM.');
      }
    } finally {
      setIsLlmLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center my-8">NEXT EVAL</h1>
      {/* File Input Section */}
      <section className="mb-8 p-6 border rounded-lg shadow-md bg-white">
        <h2 className="text-xl font-semibold mb-4">
          Upload HTML
        </h2>
        <div className="flex flex-col space-y-4">
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
            "
            accept=".html"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <button
            type="button" // Changed from submit to button to prevent default form submission
            onClick={handleProcessFile}
            disabled={isLoading || !selectedFile}
            aria-label="Submit file for processing"
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Process File'}
          </button>
        </div>
        {errorMessage && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            Error: {errorMessage}
          </p>
        )}
      </section>

      {/* Loading Indicator - more prominent */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-lg font-semibold animate-pulse">Processing file, please wait...</p>
            {/* You can add a spinner SVG or component here */}
          </div>
        </div>
      )}

      {/* Processing Steps Section */}
      {processedData && !isLoading && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Processing Stages</h2>
          {processedData.originalHtmlLength !== undefined && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg text-sm">
              <p className="font-semibold">Original Full HTML Length: <span className="font-normal">{processedData.originalHtmlLength.toLocaleString()} characters</span></p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stage 1: Slimming (Cleaned HTML) */}
            <div 
              className={`p-4 border rounded-lg shadow cursor-pointer transition-all duration-200 ${
                selectedStage === 'html' 
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' 
                  : 'bg-gray-50 hover:bg-blue-50'
              }`}
              onClick={() => setSelectedStage('html')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedStage('html')}
            >
              <h3 className="text-lg font-medium mb-1">
                1. Slimmed HTML
              </h3>
              <p className="text-xs text-gray-600 mb-2">Length: {processedData.htmlLength.toLocaleString()} chars</p>
              <div className="h-64 overflow-auto bg-white p-2 border rounded">
                <pre className="text-xs whitespace-pre-wrap">
                  {processedData.html}
                </pre>
              </div>
            </div>

            {/* Stage 2: XPath to Text (Flat) */}
            <div 
              className={`p-4 border rounded-lg shadow cursor-pointer transition-all duration-200 ${
                selectedStage === 'textMapFlat' 
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' 
                  : 'bg-gray-50 hover:bg-blue-50'
              }`}
              onClick={() => setSelectedStage('textMapFlat')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedStage('textMapFlat')}
            >
              <h3 className="text-lg font-medium mb-1">2. XPath to Flat Text Map</h3>
              <p className="text-xs text-gray-600 mb-2">Length: {processedData.textMapFlatLength.toLocaleString()} chars (JSON string)</p>
              <div className="h-64 overflow-auto bg-white p-2 border rounded">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(processedData.textMapFlat, null, 2)}
                </pre>
              </div>
            </div>

            {/* Stage 3: Hierarchical Text Map */}
            <div 
              className={`p-4 border rounded-lg shadow cursor-pointer transition-all duration-200 ${
                selectedStage === 'textMap' 
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' 
                  : 'bg-gray-50 hover:bg-blue-50'
              }`}
              onClick={() => setSelectedStage('textMap')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedStage('textMap')}
            >
              <h3 className="text-lg font-medium mb-1">3. Xpath to Hierarchical Text Map</h3>
              <p className="text-xs text-gray-600 mb-2">Length: {processedData.textMapLength.toLocaleString()} chars (JSON string)</p>
              <div className="h-64 overflow-auto bg-white p-2 border rounded">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(processedData.textMap, null, 2)}
                </pre>
              </div>
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
              Please select one of the processing stages above to interact with LLM.
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold">Selected stage for LLM: <span className="font-normal">{
                  selectedStage === 'html' ? 'Slimmed HTML' :
                  selectedStage === 'textMapFlat' ? 'XPath to Flat Text Map' :
                  'Xpath to Hierarchical Text Map'
                }</span></p>
              </div>
              <div className="mb-6">
                <label htmlFor="temperature-slider" className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature: <span className="font-semibold">{temperature.toFixed(1)}</span>
                </label>
                <input
                  id="temperature-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={handleTemperatureChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={isLlmLoading}
                />
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
        </section>
      )}
    </main>
  );
}

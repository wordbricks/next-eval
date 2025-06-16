"use client";

import { useState } from "react";

type PromptType = "slim" | "flat" | "hierarchical";

interface LlmApiResponse {
  llmResponse: string;
  systemPromptUsed: string;
  userInputUsed: string;
  fullSystemPrompt?: string;
  fullUserInput?: string;
  error?: string;
}

const LlmInteraction: React.FC = () => {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType>("slim");
  const [llmResponse, setLlmResponse] = useState<string>("");
  const [systemPromptContent, setSystemPromptContent] = useState<string>("");
  const [userInputContent, setUserInputContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handlePromptChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPrompt(event.target.value as PromptType);
    // Clear previous results when prompt changes
    setLlmResponse("");
    setSystemPromptContent("");
    setUserInputContent("");
    setError(null);
  };

  const handleAskLlm = async () => {
    setIsLoading(true);
    setLlmResponse("");
    setSystemPromptContent("");
    setUserInputContent("");
    setError(null);

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promptType: selectedPrompt }),
      });

      const data: LlmApiResponse = await response.json();

      if (!response.ok || data.error) {
        console.error("API Error:", data.error);
        setError(
          data.error || `Error: ${response.status} ${response.statusText}`,
        );
        setLlmResponse("Failed to get response from LLM.");
        return;
      }

      setLlmResponse(data.llmResponse);
      // Displaying the path of the prompt used, as returned by the API
      setSystemPromptContent(
        data.fullSystemPrompt || `System Prompt File: ${data.systemPromptUsed}`,
      );
      setUserInputContent(
        data.fullUserInput || `User Input File: ${data.userInputUsed}`,
      );
    } catch (err) {
      console.error("Network or parsing error interacting with LLM API:", err);
      setError((err as Error).message || "An unexpected error occurred.");
      setLlmResponse("Error fetching response from LLM.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-lg bg-white p-4 shadow-xl md:p-6 lg:p-8">
      <h1 className="mb-6 text-center font-bold text-3xl text-gray-800">
        LLM Interaction with Gemini
      </h1>

      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
        <label
          htmlFor="prompt-select"
          className="whitespace-nowrap font-medium text-gray-700 text-lg"
        >
          Select Prompt Type:
        </label>
        <select
          id="prompt-select"
          value={selectedPrompt}
          onChange={handlePromptChange}
          className="flex-grow rounded-md border border-gray-300 bg-white p-3 text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          aria-label="Select LLM prompt type"
        >
          <option value="slim">Slim</option>
          <option value="flat">Flat</option>
          <option value="hierarchical">Hierarchical</option>
        </select>
      </div>

      <button
        type="button"
        onClick={handleAskLlm}
        disabled={isLoading}
        className="w-full transform rounded-md bg-indigo-600 px-6 py-3 font-semibold text-white shadow-md transition-all duration-150 ease-in-out hover:scale-105 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-400"
        aria-label="Submit query to LLM"
        tabIndex={0} // Make it focusable
        onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAskLlm()} // Trigger on Enter key
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Loading indicator</title>
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Asking Gemini...
          </span>
        ) : (
          "Ask Gemini"
        )}
      </button>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          <h2 className="mb-2 font-semibold text-xl">Error:</h2>
          <pre className="whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      {systemPromptContent && !error && (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 shadow">
          <h2 className="mb-2 font-semibold text-gray-700 text-xl">
            System Prompt Used:
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-white p-3 text-gray-600 text-sm">
            {systemPromptContent}
          </pre>
        </div>
      )}

      {userInputContent && !error && (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 shadow">
          <h2 className="mb-2 font-semibold text-gray-700 text-xl">
            User Input Used:
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-white p-3 text-gray-600 text-sm">
            {userInputContent}
          </pre>
        </div>
      )}

      {llmResponse && !isLoading && !error && (
        <div className="mt-6 rounded-md border border-green-300 bg-green-50 p-4 shadow-lg">
          <h2 className="mb-2 font-semibold text-green-800 text-xl">
            Gemini Response:
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-white p-3 text-green-700 text-sm">
            {llmResponse}
          </pre>
        </div>
      )}
    </div>
  );
};

export default LlmInteraction;

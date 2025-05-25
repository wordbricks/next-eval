'use client';

import { useState } from 'react';

type PromptType = 'slim' | 'flat' | 'hierarchical';

interface LlmApiResponse {
  llmResponse: string;
  systemPromptUsed: string;
  userInputUsed: string;
  fullSystemPrompt?: string;
  fullUserInput?: string;
  error?: string;
}

const LlmInteraction: React.FC = () => {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType>('slim');
  const [llmResponse, setLlmResponse] = useState<string>('');
  const [systemPromptContent, setSystemPromptContent] = useState<string>('');
  const [userInputContent, setUserInputContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handlePromptChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPrompt(event.target.value as PromptType);
    // Clear previous results when prompt changes
    setLlmResponse('');
    setSystemPromptContent('');
    setUserInputContent('');
    setError(null);
  };

  const handleAskLlm = async () => {
    setIsLoading(true);
    setLlmResponse('');
    setSystemPromptContent('');
    setUserInputContent('');
    setError(null);

    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ promptType: selectedPrompt }),
      });

      const data: LlmApiResponse = await response.json();

      if (!response.ok || data.error) {
        console.error('API Error:', data.error);
        setError(
          data.error || `Error: ${response.status} ${response.statusText}`,
        );
        setLlmResponse('Failed to get response from LLM.');
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
      console.error('Network or parsing error interacting with LLM API:', err);
      setError(err.message || 'An unexpected error occurred.');
      setLlmResponse('Error fetching response from LLM.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto bg-white shadow-xl rounded-lg">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
        LLM Interaction with Gemini
      </h1>

      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0">
        <label
          htmlFor="prompt-select"
          className="text-lg font-medium text-gray-700 whitespace-nowrap"
        >
          Select Prompt Type:
        </label>
        <select
          id="prompt-select"
          value={selectedPrompt}
          onChange={handlePromptChange}
          className="p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex-grow text-gray-700 bg-white"
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
        className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95"
        aria-label="Submit query to LLM"
        tabIndex={0} // Make it focusable
        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAskLlm()} // Trigger on Enter key
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
          'Ask Gemini'
        )}
      </button>

      {error && (
        <div className="mt-4 p-4 border border-red-300 rounded-md bg-red-50 text-red-700">
          <h2 className="text-xl font-semibold mb-2">Error:</h2>
          <pre className="whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      {systemPromptContent && !error && (
        <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50 shadow">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">
            System Prompt Used:
          </h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-white p-3 rounded-md overflow-x-auto">
            {systemPromptContent}
          </pre>
        </div>
      )}

      {userInputContent && !error && (
        <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50 shadow">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">
            User Input Used:
          </h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-white p-3 rounded-md overflow-x-auto">
            {userInputContent}
          </pre>
        </div>
      )}

      {llmResponse && !isLoading && !error && (
        <div className="mt-6 p-4 border border-green-300 rounded-md bg-green-50 shadow-lg">
          <h2 className="text-xl font-semibold mb-2 text-green-800">
            Gemini Response:
          </h2>
          <pre className="whitespace-pre-wrap text-sm text-green-700 bg-white p-3 rounded-md overflow-x-auto">
            {llmResponse}
          </pre>
        </div>
      )}
    </div>
  );
};

export default LlmInteraction;

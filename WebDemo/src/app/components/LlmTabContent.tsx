import type { HtmlResult } from '../../lib/interfaces';
import type { LlmAllResponses, LlmStageResponse } from '../types';
import ResultDisplay from './ResultDisplay';

interface LlmTabContentProps {
  processedData: HtmlResult | null;
  selectedStage: keyof LlmAllResponses;
  selectedLlmModel: string;
  llmResponses: LlmAllResponses;
  overallLlmFetching: boolean;
  mdrIsLoading: boolean;
  randomNumber: number | null;
  feedbackSent: { [key: string]: boolean };
  copySuccess: string;
  onStageChange: (stage: keyof LlmAllResponses) => void;
  onModelChange: (model: string) => void;
  onSendToLlm: () => void;
  onFeedback: (isPositive: boolean) => void;
  onCopyToClipboard: (text: string) => void;
  getCurrentFeedbackId: () => string;
}

export default function LlmTabContent({
  processedData,
  selectedStage,
  selectedLlmModel,
  llmResponses,
  overallLlmFetching,
  mdrIsLoading,
  feedbackSent,
  copySuccess,
  onStageChange,
  onModelChange,
  onSendToLlm,
  onFeedback,
  onCopyToClipboard,
  getCurrentFeedbackId,
}: LlmTabContentProps) {
  const stageResponse = llmResponses[selectedStage];
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 items-end">
        {/* LLM Model Selection Dropdown */}
        <div>
          <label
            htmlFor="llmModelSelect"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            LLM Model
          </label>
          <select
            id="llmModelSelect"
            name="llmModelSelect"
            value={selectedLlmModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Processing method
          </label>
          <select
            id="llmDataStageSelect"
            name="llmDataStageSelect"
            value={selectedStage}
            onChange={(e) =>
              onStageChange(e.target.value as keyof LlmAllResponses)
            }
            disabled={
              overallLlmFetching ||
              llmResponses[selectedStage]?.isLoading
            }
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="html">Slimmed HTML</option>
            <option value="textMap">Hierarchical JSON</option>
            <option value="textMapFlat">Flat JSON</option>
          </select>
        </div>
      </div>
      
      {/* Send to LLM Button */}
      <div className="flex justify-center items-center mb-6">
        <button
          type="button"
          onClick={onSendToLlm}
          aria-label={`Send ${selectedStage === 'html' ? 'Slimmed HTML' : selectedStage === 'textMap' ? 'Hierarchical JSON' : 'Flat JSON'} to ${selectedLlmModel}`}
          className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            !processedData ||
            overallLlmFetching ||
            !selectedStage ||
            mdrIsLoading ||
            stageResponse?.isLoading
          }
        >
          {overallLlmFetching && stageResponse?.isLoading
            ? 'Sending to LLM...'
            : 'Send to LLM'}
        </button>
      </div>
      
      {/* Display LLM Responses */}
      {overallLlmFetching &&
        stageResponse?.isLoading &&
        !stageResponse?.content && (
          <div className="mt-6 text-center">
            <p className="text-lg font-semibold animate-pulse">
              Waiting for {selectedLlmModel} response for{' '}
              {selectedStage === 'html'
                ? 'Slimmed HTML'
                : selectedStage === 'textMap'
                  ? 'Hierarchical JSON'
                  : 'Flat JSON'}
              ...
            </p>
          </div>
        )}
        
      {stageResponse && (
        <ResultDisplay
          title="LLM Response"
          isLoading={stageResponse.isLoading}
          error={stageResponse.error}
          content={stageResponse.content}
          usage={stageResponse.usage}
          predictXpathList={stageResponse.predictXpathList}
          mappedPredictionText={stageResponse.mappedPredictionText}
          numPredictedRecords={stageResponse.numPredictedRecords}
          numHallucination={stageResponse.numHallucination}
          isEvaluating={stageResponse.isEvaluating}
          onFeedback={onFeedback}
          feedbackSent={feedbackSent[getCurrentFeedbackId()]}
          copySuccess={copySuccess}
          onCopyToClipboard={onCopyToClipboard}
        />
      )}
    </div>
  );
}
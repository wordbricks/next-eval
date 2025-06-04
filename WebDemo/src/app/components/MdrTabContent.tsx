import type { HtmlResult } from '../../lib/interfaces';
import type { MdrResponseState } from '../types';
import ResultDisplay from './ResultDisplay';

interface MdrTabContentProps {
  processedData: HtmlResult | null;
  mdrResponse: MdrResponseState;
  overallLlmFetching: boolean;
  isLoading: boolean;
  feedbackSent: { [key: string]: boolean };
  copySuccess: string;
  onRunMdr: () => void;
  onFeedback: (isPositive: boolean) => void;
  onCopyToClipboard: (text: string) => void;
  getCurrentFeedbackId: () => string;
}

export default function MdrTabContent({
  processedData,
  mdrResponse,
  overallLlmFetching,
  isLoading,
  feedbackSent,
  copySuccess,
  onRunMdr,
  onFeedback,
  onCopyToClipboard,
  getCurrentFeedbackId,
}: MdrTabContentProps) {
  return (
    <div className="mt-4">
      {/* Run MDR Button */}
      <div className="flex justify-center items-center mb-6">
        <button
          type="button"
          onClick={onRunMdr}
          aria-label="Run MDR Algorithm on Original HTML"
          className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            !processedData?.originalHtml ||
            mdrResponse.isLoading ||
            overallLlmFetching
          }
        >
          {mdrResponse.isLoading
            ? 'Running MDR...'
            : 'Run MDR Algorithm'}
        </button>
      </div>
      
      {/* MDR Response Card */}
      {processedData && !isLoading && (
        <ResultDisplay
          title="MDR Algorithm Response"
          isLoading={mdrResponse.isLoading}
          error={mdrResponse.error}
          content={
            mdrResponse.predictXpathList
              ? JSON.stringify(mdrResponse.predictXpathList, null, 2)
              : null
          }
          predictXpathList={mdrResponse.predictXpathList}
          mappedPredictionText={mdrResponse.mappedPredictionText}
          numPredictedRecords={mdrResponse.numPredictedRecords}
          showUsage={false}
          showContent={false}
          onFeedback={onFeedback}
          feedbackSent={feedbackSent[getCurrentFeedbackId()]}
          copySuccess={copySuccess}
          onCopyToClipboard={onCopyToClipboard}
        />
      )}
    </div>
  );
}
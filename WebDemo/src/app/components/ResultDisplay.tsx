import CopyIcon from '../../components/icons/CopyIcon';
import ThumbsDownIcon from '../../components/icons/ThumbsDownIcon';
import ThumbsUpIcon from '../../components/icons/ThumbsUpIcon';
import type { ValidatedXpathArray } from '../../lib/utils/xpathValidation';

interface ResultDisplayProps {
  title: string;
  isLoading: boolean;
  error: string | null;
  content?: string | null;
  usage?: string | null;
  predictXpathList?: ValidatedXpathArray | null;
  mappedPredictionText?: string[] | null;
  numPredictedRecords?: number | null;
  numHallucination?: number | null;
  isEvaluating?: boolean;
  showUsage?: boolean;
  showContent?: boolean;
  onFeedback?: (isPositive: boolean) => void;
  feedbackSent?: boolean;
  copySuccess?: string;
  onCopyToClipboard?: (text: string) => void;
}

export default function ResultDisplay({
  title,
  isLoading,
  error,
  content,
  usage,
  predictXpathList,
  mappedPredictionText,
  numPredictedRecords,
  numHallucination,
  isEvaluating = false,
  showUsage = true,
  showContent = true,
  onFeedback,
  feedbackSent = false,
  copySuccess = '',
  onCopyToClipboard,
}: ResultDisplayProps) {
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col">
      <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">
        {title}
      </h3>
      
      {isLoading && (
        <p className="text-md font-medium text-blue-600 animate-pulse">
          Loading response...
        </p>
      )}
      
      {error && (
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm"
          role="alert"
        >
          <p className="font-semibold">Error:</p>
          <pre className="whitespace-pre-wrap break-all">{error}</pre>
        </div>
      )}
      
      {!isLoading && content && !error && (
        <>
          {showUsage && usage && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold mb-1 text-gray-600">
                Usage:
              </h4>
              <div className="max-h-24 overflow-auto bg-white p-2 border rounded-md text-xs">
                <pre className="whitespace-pre-wrap">
                  {typeof usage === 'string'
                    ? usage
                    : JSON.stringify(usage, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {showContent && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold mb-1 text-gray-600">
                Content:
              </h4>
              <div className="h-48 overflow-auto bg-white p-2 border rounded-md text-xs">
                <pre className="whitespace-pre-wrap">{content}</pre>
              </div>
            </div>
          )}
          
          {mappedPredictionText && mappedPredictionText.length > 0 && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-sm font-semibold text-gray-600">
                  Predicted Text:
                </h4>
                <div className="flex items-center gap-2">
                  {onFeedback && (
                    <>
                      <button
                        type="button"
                        onClick={() => onFeedback(true)}
                        disabled={feedbackSent}
                        className={`p-1 hover:bg-green-100 rounded-full transition-colors duration-150 ease-in-out ${
                          feedbackSent
                            ? 'text-green-600'
                            : 'text-gray-400 hover:text-green-600'
                        }`}
                        aria-label="Give positive feedback"
                      >
                        <ThumbsUpIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onFeedback(false)}
                        disabled={feedbackSent}
                        className={`p-1 hover:bg-red-100 rounded-full transition-colors duration-150 ease-in-out ${
                          feedbackSent
                            ? 'text-red-600'
                            : 'text-gray-400 hover:text-red-600'
                        }`}
                        aria-label="Give negative feedback"
                      >
                        <ThumbsDownIcon />
                      </button>
                    </>
                  )}
                  {onCopyToClipboard && (
                    <button
                      type="button"
                      onClick={() =>
                        onCopyToClipboard(mappedPredictionText.join('\n'))
                      }
                      className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-full transition-colors duration-150 ease-in-out group relative"
                      aria-label="Copy predicted text to clipboard"
                    >
                      <CopyIcon />
                      {copySuccess && (
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
                          {copySuccess}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="h-40 overflow-auto bg-white p-2 border rounded-md text-xs">
                {mappedPredictionText.map((textBlock, index) => (
                  <pre
                    key={index}
                    className="whitespace-pre-wrap py-1 my-1 border-b border-gray-200 last:border-b-0"
                  >
                    {textBlock}
                  </pre>
                ))}
              </div>
            </div>
          )}
          
          <EvaluationMetrics
            isEvaluating={isEvaluating}
            predictXpathList={predictXpathList}
            numPredictedRecords={numPredictedRecords}
            numHallucination={numHallucination}
            error={error}
            content={content}
          />
        </>
      )}
      
      {!isLoading && !content && !error && (
        <p className="text-gray-500">No results yet.</p>
      )}
    </div>
  );
}

function EvaluationMetrics({
  isEvaluating,
  predictXpathList,
  numPredictedRecords,
  numHallucination,
  error,
  content,
}: {
  isEvaluating?: boolean;
  predictXpathList?: ValidatedXpathArray | null;
  numPredictedRecords?: number | null;
  numHallucination?: number | null;
  error?: string | null;
  content?: string | null;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-1 text-gray-600">
        Evaluation Metrics:
      </h4>
      <div className="p-2 bg-blue-50 border border-blue-100 rounded-md space-y-1 text-xs">
        {isEvaluating && (
          <p className="text-blue-500 animate-pulse">
            Calculating metrics...
          </p>
        )}
        
        {!isEvaluating && predictXpathList && (
          <>
            <p>
              <span className="font-semibold">Predicted Records:</span>{' '}
              {numPredictedRecords}
            </p>
            {numHallucination !== null && numHallucination !== undefined && (
              <p>
                <span className="font-semibold">
                  Potential Hallucinations:
                </span>{' '}
                {numHallucination} (
                {numPredictedRecords && numPredictedRecords > 0
                  ? `${((numHallucination / numPredictedRecords) * 100).toFixed(2)}%`
                  : 'N/A'}
                )
              </p>
            )}
          </>
        )}
        
        {!isEvaluating &&
          predictXpathList &&
          numPredictedRecords === null &&
          !error && (
            <p className="text-orange-500">
              Metrics pending or encountered an issue. Check for errors.
            </p>
          )}
        
        {!isEvaluating &&
          predictXpathList &&
          numPredictedRecords === null &&
          error &&
          error.includes('Evaluation Error:') && (
            <p className="text-red-500">
              Metrics calculation failed. See error message above.
            </p>
          )}
          
        {!isEvaluating && !predictXpathList && content && !error && (
          <p className="text-gray-500">
            No valid XPaths parsed from content.
          </p>
        )}
        
        {!isEvaluating && !content && !error && (
          <p className="text-gray-500">No content to evaluate.</p>
        )}
        
        {numPredictedRecords === 0 && (
          <p className="text-gray-500">No records predicted.</p>
        )}
      </div>
    </div>
  );
}
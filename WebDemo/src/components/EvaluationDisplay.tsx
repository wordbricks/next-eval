import type React from 'react';
import type { EvaluationResult } from '../lib/utils/evaluation';

interface EvaluationDisplayProps {
  evaluationResult: EvaluationResult | null;
  isLoading: boolean;
}

const EvaluationDisplay: React.FC<EvaluationDisplayProps> = ({
  evaluationResult,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="mt-6 text-center">
        <p className="text-lg font-semibold animate-pulse">
          Calculating evaluation metrics...
        </p>
      </div>
    );
  }

  if (!evaluationResult) {
    return (
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
        <p>
          Evaluation results will appear here once Ground Truth and Predicted
          XPaths are available.
        </p>
      </div>
    );
  }

  const formatMetric = (value: number) => `${(value * 100).toFixed(2)}%`;

  return (
    <div className="mt-6 p-6 border rounded-lg shadow-md bg-white">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">
        Step 4: Evaluation Metrics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
          <h4 className="text-md font-semibold text-sky-700">Precision</h4>
          <p className="text-2xl font-bold text-sky-900">
            {formatMetric(evaluationResult.precision)}
          </p>
        </div>
        <div className="p-4 bg-lime-50 border border-lime-200 rounded-lg">
          <h4 className="text-md font-semibold text-lime-700">Recall</h4>
          <p className="text-2xl font-bold text-lime-900">
            {formatMetric(evaluationResult.recall)}
          </p>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="text-md font-semibold text-amber-700">F1-Score</h4>
          <p className="text-2xl font-bold text-amber-900">
            {formatMetric(evaluationResult.f1)}
          </p>
        </div>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg col-span-1 md:col-span-2 lg:col-span-1">
          <h4 className="text-md font-semibold text-gray-700">
            Ground Truth Records
          </h4>
          <p className="text-2xl font-bold text-gray-900">
            {evaluationResult.numberOfGroundTruthRecords}
          </p>
        </div>
        <div
          className={`p-4 rounded-lg border ${evaluationResult.predictedRecordHasEmptyItem ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
        >
          <h4
            className={`text-md font-semibold ${evaluationResult.predictedRecordHasEmptyItem ? 'text-red-700' : 'text-green-700'}`}
          >
            Predicted Records Quality
          </h4>
          <p
            className={`text-lg font-bold ${evaluationResult.predictedRecordHasEmptyItem ? 'text-red-900' : 'text-green-900'}`}
          >
            {evaluationResult.predictedRecordHasEmptyItem
              ? 'Contains empty/invalid items'
              : 'All items appear valid'}
          </p>
        </div>
      </div>

      {/* Optional: Display mapped records for debugging 
      {evaluationResult.mappedGroundTruthRecords && (
        <div className="mt-4">
          <h4 className="text-md font-semibold">Mapped Ground Truth XPaths:</h4>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto h-48">
            {JSON.stringify(evaluationResult.mappedGroundTruthRecords, null, 2)}
          </pre>
        </div>
      )}
      {evaluationResult.mappedPredictedRecords && (
        <div className="mt-4">
          <h4 className="text-md font-semibold">Mapped Predicted XPaths:</h4>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto h-48">
            {JSON.stringify(evaluationResult.mappedPredictedRecords, null, 2)}
          </pre>
        </div>
      )}
      */}
    </div>
  );
};

export default EvaluationDisplay;

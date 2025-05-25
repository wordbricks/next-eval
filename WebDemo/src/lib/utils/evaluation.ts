export interface EvaluationResult {
  precision: number;
  recall: number;
  f1: number;
  predictedRecordHasEmptyItem: boolean;
  numberOfGroundTruthRecords: number;
  // You might want to include the mapped records for display or debugging
  // mappedPredictedRecords: string[][];
  // mappedGroundTruthRecords: string[][];
}

/**
 * Placeholder function to map LLM response (list of XPaths) to full XPaths
 * using the flat text map.
 * The actual implementation will depend on how XPaths from LLM relate to textMapFlatJson.
 * @param textMapFlatJson - The flat map of XPaths to text content.
 * @param llmResponseJson - The LLM's response, expected as string[][].
 * @returns string[][] - The processed records, presumably with full XPaths.
 */
export const mapResponseToFullXPath = (
  textMapFlatJson: Record<string, string>,
  llmResponseJson: string[][],
): string[][] => {
  console.warn(
    'mapResponseToFullXPath is a placeholder. Implement actual logic based on textMapFlatJson and llmResponseJson.',
  );
  // For now, returning the input directly or a dummy transformation.
  // This assumes llmResponseJson might already contain full XPaths or that the mapping logic is complex.
  if (!llmResponseJson) return [];
  return llmResponseJson.map((record) =>
    record.map((xpath) => {
      // Dummy transformation: replace with actual logic if XPaths need prefixing or other changes
      // e.g., if textMapFlatJson is used to resolve relative paths or validate existence.
      // const mappedXpath = textMapFlatJson[xpath] ? `/resolved/${xpath}` : `/unresolved/${xpath}`;
      return xpath; // Placeholder: returns original xpath
    }),
  );
};

/**
 * Placeholder function to calculate evaluation metrics between predicted and ground truth records.
 * @param predictRecords - Predicted records (string[][]), after mapping to full XPaths.
 * @param groundTruthRecords - Ground truth records (string[][]), after mapping to full XPaths.
 * @returns EvaluationResult - The calculated metrics.
 */
export const calculateEvaluationMetrics = (
  predictRecords: string[][],
  groundTruthRecords: string[][],
): EvaluationResult => {
  console.warn(
    'calculateEvaluationMetrics is a placeholder. Implement actual logic.',
  );

  // Dummy calculations - replace with your actual F1, precision, recall logic
  const precision = predictRecords.length > 0 ? Math.random() * 0.5 + 0.5 : 0; // Ensure some non-zero for testing
  const recall = groundTruthRecords.length > 0 ? Math.random() * 0.5 + 0.5 : 0;
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  // Check if any predicted record is empty or contains empty strings
  // Based on user's snippet: for (const record of predictRecords) { if (record.length === 0) { currentFileSumHr += 1; break; }}
  const predictedRecordHasEmptyItem = predictRecords.some(
    (record) =>
      record.length === 0 || record.some((xpath) => xpath.trim() === ''),
  );

  const numberOfGroundTruthRecords = groundTruthRecords?.length ?? 0;

  return {
    precision,
    recall,
    f1,
    predictedRecordHasEmptyItem,
    numberOfGroundTruthRecords,
  };
};

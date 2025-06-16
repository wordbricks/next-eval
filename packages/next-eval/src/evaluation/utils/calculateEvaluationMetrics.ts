import munkres from "munkres-js";
import type { EvaluationResult } from "../interfaces/EvaluationResult";
import { calculateOverlap } from "./calculateOverlap";
/**
 * Calculates Precision, Recall, and F1 score for predicted vs. ground truth records.
 * Assumes munkres-js library is installed.
 * @param predictedRecords - Array of predicted records (each record is string[]).
 * @param groundTruthRecords - Array of ground truth records (each record is string[]).
 * @returns An object containing precision, recall, and f1 score.
 */
export const calculateEvaluationMetrics = (
  predictedRecords: string[][],
  groundTruthRecords: string[][],
): EvaluationResult => {
  const M = predictedRecords.length; // Number of predicted records
  const N = groundTruthRecords.length; // Number of ground-truth records

  // Handle edge cases: no records predicted or no ground truth
  if (M === 0 && N === 0) {
    return { precision: 1, recall: 1, f1: 1, totalOverlap: 0, matches: 0 }; // Both empty, perfect match?
  }
  if (M === 0) {
    return { precision: 0, recall: 0, f1: 0, totalOverlap: 0, matches: 0 }; // Nothing predicted
  }
  if (N === 0) {
    return { precision: 0, recall: 0, f1: 0, totalOverlap: 0, matches: 0 }; // Nothing in ground truth (implies nothing should be predicted)
  }

  // Create the cost matrix (cost = 1 - overlap)
  const costMatrix: number[][] = [];
  for (let i = 0; i < M; i++) {
    costMatrix[i] = [];
    for (let j = 0; j < N; j++) {
      const overlap = calculateOverlap(
        predictedRecords[i],
        groundTruthRecords[j],
      );
      costMatrix[i][j] = 1 - overlap; // Minimize 1-overlap to maximize overlap
    }
  }

  // Use munkres to find the optimal assignment (indices of matched pairs)
  // munkres-js handles rectangular matrices
  const _K = Math.min(M, N);
  const assignmentIndices: [number, number][] = munkres(costMatrix); // Returns array of pairs [predIndex, gtIndex]

  // Calculate the total overlap sum from the optimal matching
  let maxTotalOverlap = 0;
  let matchedCount = 0;
  assignmentIndices.forEach(([predIndex, gtIndex]: [number, number]) => {
    // Check if the cost corresponds to a valid pair (costMatrix might be padded conceptually)
    if (predIndex < M && gtIndex < N) {
      const overlap = 1 - costMatrix[predIndex][gtIndex]; // Get overlap back from cost
      maxTotalOverlap += overlap;
      matchedCount++; // Count actual matches made
    }
  });

  // Calculate Precision, Recall, F1
  const precision = M > 0 ? maxTotalOverlap / M : 0;
  const recall = N > 0 ? maxTotalOverlap / N : 0;
  const f1 =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  return {
    precision,
    recall,
    f1,
    totalOverlap: maxTotalOverlap,
    matches: matchedCount,
  };
};

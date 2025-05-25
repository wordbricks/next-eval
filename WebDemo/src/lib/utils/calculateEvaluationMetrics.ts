import munkres from 'munkres-js';
import type { EvaluationResult } from '../interfaces';

export const calculateOverlap = (
  record1: string[],
  record2: string[],
): number => {
  const set1 = new Set(record1);
  const set2 = new Set(record2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) {
    return 1; // Define overlap as 1 if both sets are empty
  }

  return intersection.size / union.size;
};

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

  const K = Math.min(M, N);
  const assignmentIndices: [number, number][] = munkres(costMatrix); // Returns array of pairs [predIndex, gtIndex]

  // Calculate the total overlap sum from the optimal matching
  let maxTotalOverlap = 0;
  let matchedCount = 0;
  for (const [predIndex, gtIndex] of assignmentIndices) {
    // Check if the cost corresponds to a valid pair (costMatrix might be padded conceptually)
    if (predIndex < M && gtIndex < N) {
      const overlap = 1 - costMatrix[predIndex][gtIndex]; // Get overlap back from cost
      maxTotalOverlap += overlap;
      matchedCount++; // Count actual matches made
    }
  }

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

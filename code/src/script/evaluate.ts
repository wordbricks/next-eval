import munkres from "munkres-js";
import { calculateOverlap, slugifyUrl, mapResponseToFullXPath } from "../utils";
import { EvaluationResult } from "../interfaces/EvaluationResult";
import path from "path";
import fs from "fs";
import { DATA_PATH } from "../constant";
/**
 * Calculates Precision, Recall, and F1 score for predicted vs. ground truth records.
 * Assumes munkres-js library is installed.
 * @param predictedRecords - Array of predicted records (each record is string[]).
 * @param groundTruthRecords - Array of ground truth records (each record is string[]).
 * @returns An object containing precision, recall, and f1 score.
 */
const calculateEvaluationMetrics = (
  predictedRecords: string[][],
  groundTruthRecords: string[][]
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
      const overlap = calculateOverlap(predictedRecords[i], groundTruthRecords[j]);
      costMatrix[i][j] = 1 - overlap; // Minimize 1-overlap to maximize overlap
    }
  }

  // Use munkres to find the optimal assignment (indices of matched pairs)
  // munkres-js handles rectangular matrices
  const K = Math.min(M, N)
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
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1, totalOverlap: maxTotalOverlap, matches: matchedCount };
};

// --- Main Loop Modification (Now after function definitions) ---
//generateFileExistenceReport();


const groundTruthResponseFileName = "ground_truth.json";
const predictResponseFileNameList = ["llm_response_slim.json", "llm_response_hier.json", "llm_response_flat.json", "mdr.json"];

for (const predictResponseFileName of predictResponseFileNameList) {
    console.log(`\n--- Processing LLM File: ${predictResponseFileName} ---`);
    console.log("\n--- Average Metrics per LLM File ---");

    let currentFileSumPrecision = 0;
    let currentFileSumRecall = 0;
    let currentFileCount = 0;
    let currentFileSumF1 = 0;
    let currentFileSumHr = 0;
    let numberOfRecords = 0;

    const allUrls = fs.readdirSync(DATA_PATH);
    for (const url of allUrls) {
      if (url === "results" || url === ".DS_Store") {
        continue;
      }
      const recordSpecificDirPath = path.join(DATA_PATH, url);
      const textMapFlatPath = path.join(recordSpecificDirPath, "text_map_flat.json");
      const textMapFlatJson: Record<string, any> = JSON.parse(fs.readFileSync(textMapFlatPath, "utf-8"));

      const predictResponsePath = path.join(recordSpecificDirPath, predictResponseFileName);
      const groundTruthResponsePath = path.join(recordSpecificDirPath, groundTruthResponseFileName);
      const predictLLMResponsePath = fs.readFileSync(predictResponsePath, "utf-8");
      const groundTruthLLMResponsePath = fs.readFileSync(groundTruthResponsePath, "utf-8");
      const predictLLMResponseJson: string[][] = JSON.parse(predictLLMResponsePath);
      const groundTruthLLMResponseJson: string[][] = JSON.parse(groundTruthLLMResponsePath);

      const predictRecords = mapResponseToFullXPath(textMapFlatJson, predictLLMResponseJson);
      const groundTruthRecords = mapResponseToFullXPath(textMapFlatJson, groundTruthLLMResponseJson);

      numberOfRecords += groundTruthRecords?.length ?? 0; 

      if (predictRecords) {
          for (const record of predictRecords) {
              if (record.length === 0) {
                currentFileSumHr += 1;
                break;
              }
          }
      }

      if (predictRecords && groundTruthRecords) {
          const evaluationMetrics: EvaluationResult = calculateEvaluationMetrics(predictRecords, groundTruthRecords);
          currentFileSumPrecision += evaluationMetrics.precision;
          currentFileSumRecall += evaluationMetrics.recall;
          currentFileCount++;
          currentFileSumF1 += evaluationMetrics.f1; 
      }
    };

    const avgPrecision = currentFileCount > 0 ? currentFileSumPrecision / currentFileCount : 0;
    const avgRecall = currentFileCount > 0 ? currentFileSumRecall / currentFileCount : 0;
    const avgF1 = currentFileCount > 0 ? currentFileSumF1 / currentFileCount : 0;
    const avgHR = currentFileCount > 0 ? currentFileSumHr / currentFileCount : 0;

    console.log(`Total number of records: ${numberOfRecords}`);
    console.log(`File: ${predictResponseFileName}`);
    console.log(`  Average Precision: ${avgPrecision.toFixed(4)}`);
    console.log(`  Average Recall: ${avgRecall.toFixed(4)}`);
    console.log(`  Average F1 Score: ${avgF1.toFixed(4)}`);
    console.log(`  Average HR: ${avgHR.toFixed(4)}`);
    console.log(`  Total URLs Processed for this file: ${currentFileCount}`);
}

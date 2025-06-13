export interface EvaluationResult {
  precision: number;
  recall: number;
  f1: number;
  totalOverlap: number;
  matches: number;
}

export interface ExtendedEvaluationResult extends EvaluationResult {
  validPredictedRecords: number;
  totalPredictedRecords: number;
}

export interface EvaluationResult {
  precision: number;
  recall: number;
  f1: number;
  totalOverlap: number;
  matches: number;
}
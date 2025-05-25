type NestedTextMap = string | { [key: string]: NestedTextMap };

export interface HtmlResult {
  html: string;
  textMap: NestedTextMap; // Hierarchical text map
  textMapFlat: { [key: string]: string }; // Flat XPath to text map
  originalHtmlLength: number;
  htmlLength: number;
  textMapFlatLength: number;
  textMapLength: number;
}

export interface EvaluationResult {
  precision: number;
  recall: number;
  f1: number;
  totalOverlap: number;
  matches: number;
}

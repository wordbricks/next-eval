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

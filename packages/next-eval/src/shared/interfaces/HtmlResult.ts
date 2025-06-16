export type NestedTextMap = string | { [key: string]: NestedTextMap };

export interface HtmlResult {
  html: string;
  textMap: NestedTextMap;
  textMapFlat: { [key: string]: string };
}

export interface ExtendedHtmlResult extends HtmlResult {
  htmlLength: number;
  textMapLength: number;
  textMapFlatLength: number;
  originalHtml: string;
  originalHtmlLength?: number;
  rawHtml?: string;
}

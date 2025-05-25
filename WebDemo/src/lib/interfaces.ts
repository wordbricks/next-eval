import type { TextMapNode } from './utils/TextMapNode';

export interface HtmlResult {
  html: string;
  htmlLength: number;
  textMap: TextMapNode;
  textMapLength: number;
  textMapFlat: Record<string, string>;
  textMapFlatLength: number;
  originalHtml: string;
  originalHtmlLength?: number; // Optional as it might not always be available or relevant
  rawHtml?: string; // Added to store the original, unprocessed HTML
} 
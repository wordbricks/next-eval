import type { NestedTextMap } from "@next-eval/next-eval/shared/interfaces/HtmlResult";
import { extractTextWithXPaths } from "./extractTextWithXPaths";
import { slimHtml } from "./slimHtml";

// Helper function to process HTML content
export const processHtmlContent = async (
  htmlString: string,
): Promise<{
  html: string;
  textMapFlat: Record<string, string>;
  textMap: NestedTextMap;
  htmlLength: number;
  textMapFlatLength: number;
  textMapLength: number;
}> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // 1. Slim the HTML
  const cleanedHtml = slimHtml(doc);
  const htmlLength = cleanedHtml.length;

  // Re-parse the cleaned HTML to ensure XPaths are generated from the modified structure
  const cleanedDoc = parser.parseFromString(cleanedHtml, "text/html");

  // 2. Extract text and XPaths
  const { textMapFlat, textMap } = extractTextWithXPaths(cleanedDoc);

  const textMapFlatString = JSON.stringify(textMapFlat, null, 2);
  const textMapFlatLength = textMapFlatString.length;
  const textMapString = JSON.stringify(textMap, null, 2);
  const textMapLength = textMapString.length;

  return {
    html: cleanedHtml,
    textMapFlat,
    textMap,
    htmlLength,
    textMapFlatLength,
    textMapLength,
  };
};

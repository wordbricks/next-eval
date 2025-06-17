import type { NestedTextMap } from "../../shared/interfaces/HtmlResult";
import { parseHTML } from "./domParser";
import { extractTextWithXPaths } from "./extractTextWithXPaths";
import { slimHtml } from "./slimHtml";

// Helper function to process HTML content
export const processHtmlContent = (
  htmlString: string,
): {
  html: string;
  textMapFlat: Record<string, string>;
  textMap: NestedTextMap;
  htmlLength: number;
  textMapFlatLength: number;
  textMapLength: number;
} => {
  const doc = parseHTML(htmlString);

  // 1. Slim the HTML
  const cleanedHtml = slimHtml(doc);
  const htmlLength = cleanedHtml.length;

  // Re-parse the cleaned HTML to ensure XPaths are generated from the modified structure
  const cleanedDoc = parseHTML(cleanedHtml);

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

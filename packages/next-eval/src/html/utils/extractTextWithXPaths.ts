import type { NestedTextMap } from "../../shared/interfaces/HtmlResult";
import { createDOMContext } from "./domParser";
import { generateXPath } from "./generateXPath";

// Helper function to extract text and build flat/hierarchical maps
export const extractTextWithXPaths = (
  doc: Document,
  domContext?: ReturnType<typeof createDOMContext>,
): { textMapFlat: Record<string, string>; textMap: NestedTextMap } => {
  const textMapFlat: Record<string, string> = {};
  const textMap: NestedTextMap = {};
  const ctx = domContext || createDOMContext();
  const treeWalker = ctx.createTreeWalker(doc, 0x04); // NodeFilter.SHOW_TEXT

  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    const textContent = (
      currentNode.nodeValue ||
      currentNode.text ||
      currentNode.data ||
      ""
    )?.trim();
    if (textContent && currentNode.parentElement) {
      const xpath = generateXPath(currentNode.parentElement);
      textMapFlat[xpath] = textContent;

      // Build hierarchical map (simplified version)
      const parts = xpath.substring(1).split("/");
      let currentLevel = textMap;
      parts.forEach((part, index) => {
        const key = part; // Use the direct XPath segment as the key
        if (index === parts.length - 1) {
          currentLevel[key] = textContent;
        } else {
          if (!currentLevel[key] || typeof currentLevel[key] === "string") {
            currentLevel[key] = {};
          }
          currentLevel = currentLevel[key] as { [key: string]: NestedTextMap };
        }
      });
    }
    currentNode = treeWalker.nextNode();
  }
  return { textMapFlat, textMap };
};

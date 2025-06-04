import type { NestedTextMap } from '@/lib/interfaces';
import { generateXPath } from '@/lib/utils/generateXPath';

// Helper function to extract text and build flat/hierarchical maps
export const extractTextWithXPaths = (
  doc: Document,
): { textMapFlat: Record<string, string>; textMap: NestedTextMap } => {
  const textMapFlat: Record<string, string> = {};
  const textMap: NestedTextMap = {};
  const treeWalker = doc.createTreeWalker(
    doc.documentElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Node) => {
        // Only accept non-empty text nodes that are not inside <script> or <style>
        if (node.nodeValue && node.nodeValue.trim() !== '') {
          let parent = node.parentElement;
          while (parent) {
            if (['SCRIPT', 'STYLE'].includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    const textContent = currentNode.nodeValue?.trim();
    if (textContent && currentNode.parentElement) {
      const xpath = generateXPath(currentNode.parentElement);
      textMapFlat[xpath] = textContent;

      // Build hierarchical map (simplified version)
      const parts = xpath.substring(1).split('/');
      let currentLevel = textMap;
      parts.forEach((part, index) => {
        const key = part; // Use the direct XPath segment as the key
        if (index === parts.length - 1) {
          currentLevel[key] = textContent;
        } else {
          if (!currentLevel[key] || typeof currentLevel[key] === 'string') {
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

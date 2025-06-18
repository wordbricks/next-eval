import { runRustMDR } from "@/lib/utils/wasmLoader";
import {
  type TagNode,
  buildTagTree,
  createDOMContext,
  removeCommentScriptStyleFromHTML,
} from "@wordbricks/next-eval";

// MDR constants
export const MDR_K = 10; // Maximum length of a data region pattern
export const MDR_T = 0.3; // Similarity threshold for data region detection

type DataRecord = TagNode | TagNode[];

interface MDRResult {
  xpaths: string[][];
  records: DataRecord[];
  texts: string[];
}

function extractTextsFromRecords(records: DataRecord[]): string[] {
  const texts: string[] = [];

  function extractTextFromNode(node: TagNode): void {
    // Check if the node itself has text
    if (node.rawText?.trim()) {
      texts.push(node.rawText);
    }

    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        extractTextFromNode(child);
      }
    }
  }

  for (const record of records) {
    if (Array.isArray(record)) {
      // Handle TagNode[] case
      for (const node of record) {
        if (node && typeof node === "object") {
          extractTextFromNode(node);
        }
      }
    } else if (record && typeof record === "object") {
      // Handle single TagNode case
      extractTextFromNode(record);
    }
  }

  return texts;
}

export async function runMDRWithDetails(
  rawHtml: string,
  domContext?: ReturnType<typeof createDOMContext>,
): Promise<MDRResult> {
  const cleanedHtml = removeCommentScriptStyleFromHTML(rawHtml);

  // Use provided context or create default one
  const ctx = domContext || createDOMContext();
  const document = ctx.parseHTML(cleanedHtml);

  const htmlElement = document.documentElement;
  if (!htmlElement) {
    console.error("No HTML element found");
    return { xpaths: [], records: [], texts: [] };
  }

  const rootNode = buildTagTree(htmlElement);

  const result = await runRustMDR(rootNode, MDR_K, MDR_T);
  const finalRecords: DataRecord[] = result.finalRecords;

  // Convert to XPath arrays
  const xpaths: string[][] = finalRecords
    .map((record) => {
      if (Array.isArray(record)) {
        return record
          .filter((node) => node && typeof node === "object" && "xpath" in node)
          .map((node) => node.xpath);
      }
      if (record && typeof record === "object" && "xpath" in record) {
        return [record.xpath];
      }
      return [];
    })
    .filter((xpathArray) => xpathArray.length > 0);

  // Extract texts
  const texts = extractTextsFromRecords(finalRecords);

  return {
    xpaths,
    records: finalRecords,
    texts,
  };
}

export async function runMDR(
  rawHtml: string,
  domContext?: ReturnType<typeof createDOMContext>,
): Promise<string[][]> {
  const result = await runMDRWithDetails(rawHtml, domContext);
  return result.xpaths;
}

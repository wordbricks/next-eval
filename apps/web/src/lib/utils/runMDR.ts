import {
  type TagNode,
  buildTagTree,
  removeCommentScriptStyleFromHTML,
} from "@wordbricks/next-eval";
import { parse } from "node-html-parser";

// MDR (Mining Data Region) constants
export const MDR_K = 10; // Maximum length of a data region pattern
export const MDR_T = 0.3; // Similarity threshold for data region detection

type DataRecord = TagNode | TagNode[];

// Import WASM loader utilities
import { runRustMDR } from "@/lib/utils/wasmLoader";

export interface MDRResult {
  xpaths: string[][];
  records: DataRecord[];
  texts: string[];
}

// Helper function to extract texts from records
export function extractTextsFromRecords(records: DataRecord[]): string[] {
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

// New function that returns detailed results
export async function runMDRWithDetails(rawHtml: string): Promise<MDRResult> {
  const cleanedHtml = removeCommentScriptStyleFromHTML(rawHtml);
  const rootDom = parse(cleanedHtml, {
    lowerCaseTagName: true,
    comment: false,
  });

  // Find the HTML element (could be the root or a child)
  const htmlElement =
    rootDom.querySelector("html") ||
    rootDom.childNodes.find((node: any) => node.tagName === "html");
  if (!htmlElement) {
    console.error("No HTML element found");
    return { xpaths: [], records: [], texts: [] };
  }

  const rootNode = buildTagTree(htmlElement);

  // Use Rust implementation
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

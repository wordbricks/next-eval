import {
  type MDRResult,
  MDR_K,
  MDR_T,
  extractTextsFromRecords,
} from "@/lib/utils/runMDR";
import type { DataRecord } from "@/lib/utils/wasmLoader";
import {
  type TagNode,
  buildTagTree,
  removeCommentScriptStyleFromHTML,
} from "@wordbricks/next-eval";
import { parse } from "node-html-parser";

// Worker instance management
let worker: Worker | null = null;

function getOrCreateWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/mdr.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

// Worker-based MDR execution
async function runMDRInWorker(
  rootNode: TagNode,
  K: number,
  T: number,
): Promise<{
  regions: any[];
  records: DataRecord[];
  orphans: TagNode[];
  finalRecords: DataRecord[];
}> {
  const worker = getOrCreateWorker();

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      const { type, result, error } = event.data;

      switch (type) {
        case "progress":
          // Ignore progress messages
          break;
        case "result":
          worker.removeEventListener("message", handleMessage);
          resolve(result);
          break;
        case "error":
          worker.removeEventListener("message", handleMessage);
          reject(new Error(error || "Unknown error in worker"));
          break;
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({ type: "run", rootNode, K, T });
  });
}

// New function that returns detailed results using Web Worker
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

  // Use Web Worker for MDR execution
  const result = await runMDRInWorker(rootNode, MDR_K, MDR_T);
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

export async function runMDR(rawHtml: string): Promise<string[][]> {
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
    return [];
  }

  const rootNode = buildTagTree(htmlElement);

  // Use Web Worker for MDR execution
  const { finalRecords } = await runMDRInWorker(rootNode, MDR_K, MDR_T);

  // Convert to XPath arrays
  const finalRecordXpaths: string[][] = finalRecords
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

  return finalRecordXpaths;
}

// Cleanup function to terminate worker
export function terminateMDRWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

import { MDR_K, MDR_T } from "@/lib/utils/runMDR";
import type { DataRecord } from "@/lib/utils/wasmLoader";
import { wait } from "@/utils/wait";
import {
  type TagNode,
  buildTagTree,
  removeCommentScriptStyleFromHTML,
} from "@wordbricks/next-eval";
import ms from "ms";
import { parse } from "node-html-parser";

let worker: Worker | null = null;
let workerReadyPromise: Promise<void> | null = null;

function createWorker(): { worker: Worker; ready: Promise<void> } {
  console.log("[runMDRWorker] Creating new worker...");
  const newWorker = new Worker(
    new URL("../workers/mdr.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
  console.log("[runMDRWorker] Worker created");

  const initPromise = new Promise<void>((resolve, reject) => {
    const messageHandler = function initHandler(event: MessageEvent) {
      console.log(
        "[runMDRWorker] Received message from worker:",
        event.data.type,
      );
      if (event.data.type === "initialized") {
        console.log("[runMDRWorker] MDR Worker WASM initialized successfully");
        newWorker.removeEventListener("message", initHandler);
        resolve();
      } else if (event.data.type === "error") {
        console.error(
          "[runMDRWorker] Worker initialization error:",
          event.data.error,
        );
        newWorker.removeEventListener("message", initHandler);
        reject(new Error(event.data.error || "Worker initialization failed"));
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      console.error("[runMDRWorker] Worker error event:", error);
      newWorker.removeEventListener("error", errorHandler);
      newWorker.removeEventListener("message", messageHandler);
      reject(new Error(`Worker error: ${error.message}`));
    };

    newWorker.addEventListener("message", messageHandler);
    newWorker.addEventListener("error", errorHandler);

    console.log("[runMDRWorker] Sending init message to worker");
    newWorker.postMessage({ type: "init" });
  });

  const ready = Promise.race([
    initPromise,
    wait(ms("10s")).then(() => {
      throw new Error("Worker initialization timed out after 10 seconds");
    }),
  ]);

  return { worker: newWorker, ready };
}

function getOrCreateWorker(): { worker: Worker; ready: Promise<void> } {
  if (!worker || !workerReadyPromise) {
    console.log("[runMDRWorker] No existing worker, creating new one");
    const created = createWorker();
    worker = created.worker;
    workerReadyPromise = created.ready;

    // Handle worker failure
    workerReadyPromise.catch((error) => {
      console.error("[runMDRWorker] Worker failed to initialize:", error);
      // Reset to allow retry on next call
      worker = null;
      workerReadyPromise = null;
    });
  } else {
    console.log("[runMDRWorker] Reusing existing worker");
  }
  return { worker, ready: workerReadyPromise };
}

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
  console.time("MDR Worker Total");
  const { worker, ready } = getOrCreateWorker();

  try {
    console.log("[runMDRWorker] Waiting for worker to be ready...");
    await ready;
    console.log("[runMDRWorker] Worker is ready");
  } catch (error) {
    console.error("[runMDRWorker] Worker initialization failed:", error);
    throw error;
  }

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      const { type, result, error } = event.data;

      switch (type) {
        case "result":
          worker.removeEventListener("message", handleMessage);
          console.timeEnd("MDR Worker Total");
          resolve(result);
          break;
        case "error":
          worker.removeEventListener("message", handleMessage);
          console.timeEnd("MDR Worker Total");
          reject(new Error(error || "Unknown error in worker"));
          break;
      }
    };

    worker.addEventListener("message", handleMessage);
    console.time("DOM Serialization");
    worker.postMessage({ type: "run", rootNode, K, T });
    console.timeEnd("DOM Serialization");
  });
}

export async function runMDRViaWorker(rawHtml: string): Promise<string[][]> {
  const cleanedHtml = removeCommentScriptStyleFromHTML(rawHtml);
  const rootDom = parse(cleanedHtml, {
    lowerCaseTagName: true,
    comment: false,
  });

  const htmlElement =
    rootDom.querySelector("html") ||
    rootDom.childNodes.find((node: any) => node.tagName === "html");
  if (!htmlElement) {
    console.error("No HTML element found");
    return [];
  }

  const rootNode = buildTagTree(htmlElement);

  const { finalRecords } = await runMDRInWorker(rootNode, MDR_K, MDR_T);

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

export function terminateMDRWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    workerReadyPromise = null;
  }
}

if (typeof window !== "undefined") {
  console.log(
    "[runMDRWorker] Browser environment detected, pre-initializing worker...",
  );
  getOrCreateWorker()
    .ready.then(() => {
      console.log("[runMDRWorker] Worker pre-initialization successful");
    })
    .catch((error) => {
      console.error(
        "[runMDRWorker] Failed to pre-initialize MDR worker:",
        error,
      );
    });
}

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
    let settled = false;

    // Set timeout for initialization
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        newWorker.terminate();
        reject(new Error("Worker initialization timed out after 15 seconds"));
      }
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      newWorker.removeEventListener("message", messageHandler);
      newWorker.removeEventListener("error", errorHandler);
      newWorker.removeEventListener("messageerror", messageErrorHandler);
    };

    const messageHandler = (event: MessageEvent) => {
      console.log(
        "[runMDRWorker] Received message from worker:",
        event.data.type,
      );

      if (event.data.type === "ready" && !settled) {
        settled = true;
        console.log("[runMDRWorker] Worker reports ready");
        cleanup();
        resolve();
      } else if (event.data.type === "error" && !settled) {
        settled = true;
        console.error(
          "[runMDRWorker] Worker initialization error:",
          event.data.error,
        );
        cleanup();
        reject(new Error(event.data.error || "Worker initialization failed"));
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      console.error("[runMDRWorker] Worker error event:", error);
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Worker error: ${error.message}`));
      }
    };

    const messageErrorHandler = (error: MessageEvent) => {
      console.error(
        "[runMDRWorker] Worker messageerror event (structured-clone failure):",
        error,
      );
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Worker messageerror: Failed to clone data`));
      }
    };

    newWorker.addEventListener("message", messageHandler);
    newWorker.addEventListener("error", errorHandler);
    newWorker.addEventListener("messageerror", messageErrorHandler);

    console.log("[runMDRWorker] Sending init message to worker");
    newWorker.postMessage({ type: "init" });
  });

  return { worker: newWorker, ready: initPromise };
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
    console.log("[runMDRWorker] Ready promise state:", ready);
    await ready;
    console.log("[runMDRWorker] Worker is ready");

    // Send start-pool message to let wasm-bindgen-rayon consume it and remove its stub
    await new Promise<void>((res, rej) => {
      const once = (e: MessageEvent) => {
        if (e.data?.type === "pool-ready") {
          worker.removeEventListener("message", once);
          console.log("[runMDRWorker] Thread pool ready");
          res();
        }
        if (e.data?.type === "error") {
          worker.removeEventListener("message", once);
          console.error(
            "[runMDRWorker] Thread pool initialization error:",
            e.data.error,
          );
          rej(new Error(e.data.error || "Failed to initialize thread pool"));
        }
      };
      worker.addEventListener("message", once);
      console.log("[runMDRWorker] Sending start-pool message");
      worker.postMessage({
        type: "start-pool",
        threads: navigator.hardwareConcurrency ?? 4,
      });
    });
  } catch (error) {
    console.error("[runMDRWorker] Worker initialization failed:", error);
    throw error;
  }

  const workerPromise = new Promise<{
    regions: any[];
    records: DataRecord[];
    orphans: TagNode[];
    finalRecords: DataRecord[];
  }>((resolve, reject) => {
    let messageCount = 0;
    const handleMessage = (event: MessageEvent) => {
      messageCount++;
      console.log(
        `[runMDRWorker] Received message #${messageCount} from worker during run:`,
        event.data.type,
      );
      const { type, result, error } = event.data;

      switch (type) {
        case "result":
          console.log("[runMDRWorker] Received result from worker");
          worker.removeEventListener("message", handleMessage);
          console.timeEnd("MDR Worker Total");
          resolve(result);
          break;
        case "error":
          console.error("[runMDRWorker] Received error from worker:", error);
          worker.removeEventListener("message", handleMessage);
          console.timeEnd("MDR Worker Total");
          reject(new Error(error || "Unknown error in worker"));
          break;
        case "ready":
          console.log("[runMDRWorker] Worker reports ready during run");
          break;
        default:
          console.log("[runMDRWorker] Received unexpected message type:", type);
      }
    };

    console.log("[runMDRWorker] Adding message listener for run");
    worker.addEventListener("message", handleMessage);

    console.time("DOM Serialization");
    console.log(
      "[runMDRWorker] Posting run message to worker with K=",
      K,
      "T=",
      T,
    );
    console.log("[runMDRWorker] Worker object before posting:", {
      workerExists: !!worker,
      workerType: typeof worker,
      hasPostMessage: typeof worker.postMessage === "function",
      workerToString: worker.toString(),
    });

    try {
      console.log("[runMDRWorker] About to call postMessage...");
      const message = { type: "run", rootNode, K, T };
      console.log("[runMDRWorker] Message to send:", {
        type: message.type,
        hasRootNode: !!message.rootNode,
        K: message.K,
        T: message.T,
      });
      worker.postMessage(message);
      console.log("[runMDRWorker] postMessage called successfully");
    } catch (postError) {
      console.error(
        "[runMDRWorker] Failed to post message to worker:",
        postError,
      );
      worker.removeEventListener("message", handleMessage);
      reject(
        new Error(
          `Failed to send data to worker: ${postError instanceof Error ? postError.message : "Unknown error"}`,
        ),
      );
      return;
    }
    console.timeEnd("DOM Serialization");
    console.log("[runMDRWorker] Run message posted, waiting for response...");
  });

  // Add timeout using Promise.race pattern
  return Promise.race([
    workerPromise,
    wait(ms("60s")).then(() => {
      console.error("[runMDRWorker] Worker timed out, terminating...");
      terminateMDRWorker();
      throw new Error("MDR worker processing timed out after 60 seconds");
    }),
  ]);
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
    console.log("[runMDRWorker] Terminating worker");
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

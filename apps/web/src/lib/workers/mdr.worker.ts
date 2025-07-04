// CRITICAL: Set up message handler immediately to avoid race conditions
// This MUST be before any imports to ensure no messages are lost
self.onmessage = handleMessage;

import type {
  DataRecord,
  MdrFullOutput,
  RustMDRModule,
} from "@/lib/utils/wasmLoader";
import type { TagNode } from "@wordbricks/next-eval";

// Worker-side message types
interface MdrWorkerRequest {
  type: "run";
  rootNode: TagNode;
  K: number;
  T: number;
}

interface MdrWorkerResponse {
  type: "result" | "error" | "initialized" | "ready" | "pool-ready";
  result?: {
    regions: any[];
    records: DataRecord[];
    orphans: TagNode[];
    finalRecords: DataRecord[];
  };
  error?: string;
}

let wasmModule: RustMDRModule | null = null;
let initPromise: Promise<void> | null = null;
let isInitialized = false;

// Initialize WASM in the worker
async function initializeWasm(): Promise<void> {
  console.log("[mdr.worker] initializeWasm called");
  if (wasmModule) {
    console.log("[mdr.worker] WASM module already loaded");
    return;
  }
  if (initPromise) {
    console.log("[mdr.worker] WASM initialization already in progress");
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.time("WASM initialization");

      // Construct URLs with the base path from next.config.ts
      const basePath = "/next-eval";
      const wasmPath = `${basePath}/rust_mdr_pkg/rust_mdr_utils.js`;
      const importUrl = new URL(wasmPath, self.location.origin).href;

      console.log("[mdr.worker] Importing WASM from:", importUrl);

      const importedModule = await import(
        /* webpackIgnore: true */
        importUrl
      );

      // The default export is the init function, call it with the wasm path
      const wasmBinaryPath = `${basePath}/rust_mdr_pkg/rust_mdr_utils_bg.wasm`;
      const wasmUrl = new URL(wasmBinaryPath, self.location.origin).href;

      console.log("[mdr.worker] Initializing WASM with binary:", wasmUrl);
      await importedModule.default(wasmUrl);

      wasmModule = importedModule as RustMDRModule;

      // Verify WASM module has expected methods
      console.log(
        "[mdr.worker] WASM module initialized. Available exports:",
        Object.keys(importedModule).filter(
          (key) => typeof importedModule[key] === "function",
        ),
      );

      if (!wasmModule.runMdrFull) {
        throw new Error("WASM module missing runMdrFull method");
      }

      isInitialized = true;
      console.log("[mdr.worker] WASM module loaded successfully");
      console.timeEnd("WASM initialization");
    } catch (error) {
      console.error("[mdr.worker] WASM initialization failed:", error);
      initPromise = null; // Reset on error to allow retry
      throw new Error(
        `Failed to initialize WASM in worker: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  })();

  return initPromise;
}

// Process MDR request
async function processMDR(request: MdrWorkerRequest): Promise<void> {
  console.log("[mdr.worker] processMDR called");
  try {
    console.time("MDR total processing");

    // Ensure WASM is initialized
    if (!isInitialized) {
      console.log("[mdr.worker] WASM not initialized, initializing now...");
      await initializeWasm();
    }

    if (!wasmModule || !isInitialized) {
      throw new Error("WASM module not initialized");
    }

    console.log("[mdr.worker] WASM is ready, running MDR algorithm...");

    console.time("MDR algorithm execution");
    console.log(
      "[mdr.worker] Calling wasmModule.runMdrFull with K=",
      request.K,
      "T=",
      request.T,
    );

    let mdrResult: unknown;
    try {
      // Run the MDR algorithm
      mdrResult = wasmModule.runMdrFull(request.rootNode, request.K, request.T);
      console.log("[mdr.worker] runMdrFull completed");
    } catch (wasmError) {
      console.error("[mdr.worker] WASM runMdrFull error:", wasmError);
      throw new Error(
        `WASM execution failed: ${wasmError instanceof Error ? wasmError.message : "Unknown WASM error"}`,
      );
    }

    const { regions, records, orphans } = mdrResult as unknown as MdrFullOutput;
    console.log(
      "[mdr.worker] MDR algorithm completed. Regions:",
      regions?.length,
      "Records:",
      records?.length,
      "Orphans:",
      orphans?.length,
    );
    console.timeEnd("MDR algorithm execution");

    // Combine records (avoiding duplicates)
    const finalRecords = [...records];
    const recordSet = new Set(
      records
        .filter((r): r is TagNode => !Array.isArray(r))
        .map((r) => r.xpath),
    );

    orphans.forEach((orphan) => {
      if (!recordSet.has(orphan.xpath)) {
        finalRecords.push(orphan);
      }
    });

    console.timeEnd("MDR total processing");

    // Send final result
    self.postMessage({
      type: "result",
      result: { regions, records, orphans, finalRecords },
    } as MdrWorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error in worker",
    } as MdrWorkerResponse);
  }
}

// Main message handler - NO WRAPPING OR REPLACEMENT
async function handleMessage(event: MessageEvent) {
  console.log("[mdr.worker] Message received:", event.data?.type);

  try {
    switch (event.data?.type) {
      case "init":
        console.log("[mdr.worker] Processing init message");
        try {
          await initializeWasm();
          console.log("[mdr.worker] Sending ready signal");
          self.postMessage({ type: "ready" });
        } catch (error) {
          console.error("[mdr.worker] Init error:", error);
          self.postMessage({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to initialize WASM",
          });
        }
        break;

      case "run":
        console.log("[mdr.worker] Processing run message");
        await processMDR(event.data as MdrWorkerRequest);
        break;

      default:
        console.log("[mdr.worker] Unknown message type:", event.data?.type);
    }
  } catch (error) {
    console.error("[mdr.worker] Error in message handler:", error);
    self.postMessage({
      type: "error",
      error:
        error instanceof Error ? error.message : "Error in message handler",
    });
  }
}

console.log("[mdr.worker] Worker ready to receive messages");

// Add error handlers
self.addEventListener("error", (error) => {
  console.error("[mdr.worker] Unhandled error in worker:", error);
  self.postMessage({
    type: "error",
    error: `Unhandled worker error: ${error.message || "Unknown error"}`,
  });
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("[mdr.worker] Unhandled promise rejection:", event.reason);
  self.postMessage({
    type: "error",
    error: `Unhandled promise rejection: ${event.reason}`,
  });
});

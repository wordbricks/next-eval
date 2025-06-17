// CRITICAL: Ensure worker message handling works on Vercel production
// This must be the VERY FIRST code that runs in the worker

// Use a global flag to track if we're in the wasm-bindgen initialization phase
(self as any).__wasm_bindgen_thread_id = undefined;

// Message queue to handle messages that arrive before handler is ready
const messageQueue: MessageEvent[] = [];
let isHandlerReady = false;

// Register a capturing phase handler immediately that:
// 1. Queues messages if our handler isn't ready
// 2. Always runs before wasm-bindgen-rayon's stub (due to capturing phase)
self.addEventListener(
  "message",
  function tempHandler(event: MessageEvent) {
    // Special handling for wasm-bindgen thread pool initialization
    if (
      !isHandlerReady &&
      event.data &&
      typeof event.data === "object" &&
      "__wasm_bindgen_thread_id" in event.data
    ) {
      console.log(
        "[mdr.worker] Allowing wasm-bindgen thread pool message to pass through",
      );
      return; // Let wasm-bindgen handle its own initialization
    }

    if (!isHandlerReady) {
      console.log(
        "[mdr.worker] Queueing message (handler not ready):",
        event.data?.type,
      );
      messageQueue.push(event);
      event.stopImmediatePropagation(); // Prevent any other handlers from running
    }
  },
  true,
);

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
  type: "result" | "error" | "initialized" | "ready";
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

// Single source of truth for readiness
let readyResolve!: () => void;
const readyPromise = new Promise<void>((r) => (readyResolve = r));

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

      // Initialize thread pool immediately if available (for wasm-bindgen-rayon)
      const moduleWithPool = importedModule as any;
      if (moduleWithPool.initThreadPool) {
        console.log("[mdr.worker] Initializing thread pool...");
        try {
          await moduleWithPool.initThreadPool(
            navigator.hardwareConcurrency || 4,
          );
          console.log("[mdr.worker] Thread pool initialized successfully");
        } catch (poolError) {
          console.warn(
            "[mdr.worker] Thread pool initialization failed:",
            poolError,
          );
          // Continue without threads - single-threaded fallback
        }
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

// Main message handler
async function handleMessage(event: MessageEvent) {
  console.log("[mdr.worker] Message received:", event.data?.type);

  try {
    switch (event.data?.type) {
      case "init":
        console.log("[mdr.worker] Processing init message");
        if (isInitialized) {
          console.log("[mdr.worker] Already initialized, sending ready");
          self.postMessage({ type: "ready" });
          return;
        }

        try {
          await initializeWasm();
          isInitialized = true;
          readyResolve(); // Settle the ready promise
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

      case "start-pool":
        console.log(
          "[mdr.worker] Processing start-pool message (already initialized during WASM init)",
        );
        // Thread pool is already initialized during WASM initialization
        // Just respond to maintain protocol compatibility
        self.postMessage({ type: "pool-ready" });
        break;

      case "run":
        console.log("[mdr.worker] Processing run message");
        // Wait for initialization to complete
        await readyPromise;

        try {
          await processMDR(event.data as MdrWorkerRequest);
          console.log("[mdr.worker] Run message processed successfully");
        } catch (error) {
          console.error("[mdr.worker] Run message error:", error);
          self.postMessage({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unknown error in processMDR",
          });
        }
        break;

      default:
        console.log("[mdr.worker] Unknown message type:", event.data?.type);
    }
  } catch (error) {
    console.error("[mdr.worker] Catastrophic error in message handler:", error);
    self.postMessage({
      type: "error",
      error:
        error instanceof Error ? error.message : "Catastrophic error in worker",
    });
  }
}

// Register the real message handler
self.addEventListener("message", handleMessage, true);

// Mark handler as ready and process any queued messages
isHandlerReady = true;
console.log(
  "[mdr.worker] Worker ready to receive messages, processing",
  messageQueue.length,
  "queued messages",
);

// Process any messages that arrived before the handler was ready
while (messageQueue.length > 0) {
  const queuedEvent = messageQueue.shift()!;
  console.log(
    "[mdr.worker] Processing queued message:",
    queuedEvent.data?.type,
  );
  handleMessage(queuedEvent);
}

// Heartbeat to confirm worker is alive (less frequent to reduce noise)
setInterval(() => {
  console.log("[mdr.worker] Heartbeat - initialized:", isInitialized);
}, 30000);

// Add a global error handler
self.addEventListener("error", (error) => {
  console.error("[mdr.worker] Unhandled error in worker:", error);
  self.postMessage({
    type: "error",
    error: `Unhandled worker error: ${error.message || "Unknown error"}`,
  });
});

// Add unhandled rejection handler
self.addEventListener("unhandledrejection", (event) => {
  console.error("[mdr.worker] Unhandled promise rejection:", event.reason);
  self.postMessage({
    type: "error",
    error: `Unhandled promise rejection: ${event.reason}`,
  });
});

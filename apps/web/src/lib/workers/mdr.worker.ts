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
    const maxRetries = 3;
    const retryDelay = 500; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.time(`WASM initialization attempt ${attempt}`);
        // Use self.location.origin to get the correct base URL in worker context
        const basePath = "/next-eval";
        const importPath = `${self.location.origin}${basePath}/rust_mdr_pkg/rust_mdr_utils.js`;
        console.log(
          `[mdr.worker] Attempt ${attempt}: Importing WASM from:`,
          importPath,
        );

        const importedModule = await import(
          /* webpackIgnore: true */
          importPath
        );

        // Initialize WASM
        if (typeof importedModule.default === "function") {
          console.log("[mdr.worker] Initializing WASM module...");
          await importedModule.default();
        }

        wasmModule = importedModule as RustMDRModule;

        // Verify WASM module has expected methods
        console.log(
          "[mdr.worker] WASM module methods:",
          Object.keys(importedModule),
        );
        if (!wasmModule.runMdrFull) {
          throw new Error("WASM module missing runMdrFull method");
        }

        isInitialized = true;
        console.log("[mdr.worker] WASM module loaded successfully");
        console.timeEnd(`WASM initialization attempt ${attempt}`);
        return; // Success, exit the retry loop
      } catch (error) {
        console.error(
          `[mdr.worker] WASM initialization attempt ${attempt} failed:`,
          error,
        );

        if (attempt === maxRetries) {
          initPromise = null; // Reset on final error to allow retry
          throw new Error(
            `Failed to initialize WASM in worker after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }

        // Wait before retry
        console.log(`[mdr.worker] Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
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

// Single, permanent message handler - no swapping!
self.addEventListener("message", async (event: MessageEvent) => {
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
});

// Clear onmessage to make it obvious we're using addEventListener
self.onmessage = null;

console.log("[mdr.worker] Worker ready to receive messages");

// Heartbeat to confirm worker is alive
setInterval(() => {
  console.debug(
    "[mdr.worker] Heartbeat - worker is alive, initialized:",
    isInitialized,
  );
}, 5000);

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

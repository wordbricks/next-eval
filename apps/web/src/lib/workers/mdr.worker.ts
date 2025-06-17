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
  type: "result" | "error" | "initialized";
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
        console.log("[mdr.worker] Current location:", self.location.href);

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

    console.time("MDR algorithm execution");
    // Run the MDR algorithm
    const { regions, records, orphans } = wasmModule.runMdrFull(
      request.rootNode,
      request.K,
      request.T,
    ) as unknown as MdrFullOutput;
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

// Listen for messages
self.addEventListener(
  "message",
  async (event: MessageEvent<MdrWorkerRequest | { type: "init" }>) => {
    console.log("[mdr.worker] Received message:", event.data.type);
    if (event.data.type === "init") {
      // Pre-initialize WASM
      console.log("[mdr.worker] Processing init message");
      try {
        await initializeWasm();
        console.log("[mdr.worker] Sending initialized message");
        self.postMessage({ type: "initialized" });
      } catch (error) {
        console.error("[mdr.worker] Init message error:", error);
        self.postMessage({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to initialize WASM",
        });
      }
    } else if (event.data.type === "run") {
      console.log("[mdr.worker] Processing run message");
      await processMDR(event.data);
    }
  },
);

// Worker will wait for explicit init message to initialize WASM
console.log("[mdr.worker] Worker script loaded, waiting for init message");

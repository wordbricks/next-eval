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
    console.log("[mdr.worker] rootNode structure:", {
      hasXpath: !!request.rootNode?.xpath,
      hasChildren: !!request.rootNode?.children,
      childrenCount: request.rootNode?.children?.length || 0,
      tag: request.rootNode?.tag,
    });

    let mdrResult: unknown;
    try {
      // Run the MDR algorithm
      console.log("[mdr.worker] About to call runMdrFull...");
      console.log(
        "[mdr.worker] wasmModule.runMdrFull type:",
        typeof wasmModule.runMdrFull,
      );
      mdrResult = wasmModule.runMdrFull(request.rootNode, request.K, request.T);
      console.log("[mdr.worker] runMdrFull completed");
      console.log("[mdr.worker] mdrResult type:", typeof mdrResult);
      console.log("[mdr.worker] mdrResult value:", mdrResult);
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

// Listen for messages
self.addEventListener(
  "message",
  async (event: MessageEvent<MdrWorkerRequest | { type: "init" }>) => {
    console.log("[mdr.worker] Message event fired");
    console.log("[mdr.worker] Received message:", event.data.type);
    console.log(
      "[mdr.worker] Full message data:",
      JSON.stringify({
        type: event.data.type,
        hasRootNode: event.data.type === "run" ? !!event.data.rootNode : false,
        K: event.data.type === "run" ? event.data.K : undefined,
        T: event.data.type === "run" ? event.data.T : undefined,
      }),
    );

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
      try {
        await processMDR(event.data);
      } catch (error) {
        console.error("[mdr.worker] Error in processMDR:", error);
        self.postMessage({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Unknown error in processMDR",
        });
      }
    }
  },
);

// Worker will wait for explicit init message to initialize WASM
console.log("[mdr.worker] Worker script loaded, waiting for init message");

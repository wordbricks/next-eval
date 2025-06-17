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

// Initialize WASM in the worker
async function initializeWasm(): Promise<void> {
  if (wasmModule) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.time("WASM initialization");
      // Use self.location.origin to get the correct base URL in worker context
      const importPath = `${self.location.origin}/next-eval/rust_mdr_pkg/rust_mdr_utils.js`;

      const importedModule = await import(
        /* webpackIgnore: true */
        importPath
      );

      // Initialize WASM
      if (typeof importedModule.default === "function") {
        await importedModule.default();
      }

      wasmModule = importedModule as RustMDRModule;
      console.timeEnd("WASM initialization");
    } catch (error) {
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
  try {
    console.time("MDR total processing");

    // Initialize WASM if needed (should already be initialized)
    await initializeWasm();

    if (!wasmModule) {
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
    if (event.data.type === "init") {
      // Pre-initialize WASM
      try {
        await initializeWasm();
        self.postMessage({ type: "initialized" });
      } catch (error) {
        self.postMessage({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to initialize WASM",
        });
      }
    } else if (event.data.type === "run") {
      await processMDR(event.data);
    }
  },
);

// Pre-initialize WASM immediately when worker starts
initializeWasm().catch((error) => {
  console.error("Failed to pre-initialize WASM:", error);
});

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
  type: "progress" | "result" | "error";
  progress?: number;
  result?: {
    regions: any[];
    records: DataRecord[];
    orphans: TagNode[];
    finalRecords: DataRecord[];
  };
  error?: string;
}

let wasmModule: RustMDRModule | null = null;

// Initialize WASM in the worker
async function initializeWasm(): Promise<void> {
  if (wasmModule) return;

  try {
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
  } catch (error) {
    throw new Error(
      `Failed to initialize WASM in worker: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Process MDR request
async function processMDR(request: MdrWorkerRequest): Promise<void> {
  try {
    // Send initial progress
    self.postMessage({ type: "progress", progress: 5 } as MdrWorkerResponse);

    // Initialize WASM if needed
    await initializeWasm();

    if (!wasmModule) {
      throw new Error("WASM module not initialized");
    }

    self.postMessage({ type: "progress", progress: 10 } as MdrWorkerResponse);

    // Run the MDR algorithm
    const { regions, records, orphans } = wasmModule.runMdrFull(
      request.rootNode,
      request.K,
      request.T,
    ) as unknown as MdrFullOutput;

    self.postMessage({ type: "progress", progress: 90 } as MdrWorkerResponse);

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

    self.postMessage({ type: "progress", progress: 100 } as MdrWorkerResponse);

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
  async (event: MessageEvent<MdrWorkerRequest>) => {
    if (event.data.type === "run") {
      await processMDR(event.data);
    }
  },
);

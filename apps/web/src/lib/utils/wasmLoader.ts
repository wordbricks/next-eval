// WASM loader for the complete Rust MDR implementation

import type { TagNode } from "@wordbricks/next-eval";

export interface RegionsMapItem {
  parent_xpath: string;
  regions: Array<[number, number, number]>; // [gnLength, startIdx, nodeCount]
}

export type DataRecord = TagNode | TagNode[];

export interface MdrFullOutput {
  regions: RegionsMapItem[];
  records: DataRecord[];
  orphans: TagNode[];
}

export interface RustMDRModule {
  default: () => Promise<void>;
  init: () => void;
  runMdrAlgorithm: (root: TagNode, k?: number, t?: number) => RegionsMapItem[];
  identifyAllDataRecords: (
    regions: RegionsMapItem[],
    t: number,
    root: TagNode,
  ) => DataRecord[];
  findOrphanRecords: (
    regions: RegionsMapItem[],
    t: number,
    root: TagNode,
  ) => TagNode[];
  getNormalizedEditDistance: (s1: string, s2: string) => number;
  get_normalized_edit_distance_wasm: (s1: string, s2: string) => number;
  runMdrFull: (root: TagNode, k?: number, t?: number) => MdrFullOutput;
}

let wasmModule: RustMDRModule | null = null;
let wasmInitializationPromise: Promise<void> | null = null;

export const initializeWasm = async (): Promise<void> => {
  if (wasmModule) return;
  if (wasmInitializationPromise) return wasmInitializationPromise;

  wasmInitializationPromise = (async () => {
    try {
      // Dynamic import with Next.js basePath
      const importPath =
        typeof window !== "undefined"
          ? "/next-eval/rust_mdr_pkg/rust_mdr_utils.js"
          : `${process.cwd()}/public/rust_mdr_pkg/rust_mdr_utils.js`;

      const importedModule = await import(
        /* webpackIgnore: true */
        importPath
      ).catch((error) => {
        throw new Error(
          `Failed to load Rust MDR WASM module: ${error.message}`,
        );
      });

      // Initialize WASM
      if (typeof importedModule.default === "function") {
        await importedModule.default();
      }

      wasmModule = importedModule as RustMDRModule;
    } catch (error) {
      console.error("Failed to initialize Rust MDR WASM module:", error);
      wasmInitializationPromise = null; // Allow retry on next call
      throw new Error(
        `Rust MDR WASM initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  })();

  await wasmInitializationPromise;
};

export const getWasmModule = (): RustMDRModule => {
  if (!wasmModule) {
    throw new Error(
      "Rust MDR WASM module not initialized. Call initializeWasm first.",
    );
  }
  return wasmModule;
};

// High-level function to run the complete MDR algorithm
export const runRustMDR = async (
  rootNode: TagNode,
  K = 10,
  T = 0.3,
): Promise<{
  regions: RegionsMapItem[];
  records: DataRecord[];
  orphans: TagNode[];
  finalRecords: DataRecord[];
}> => {
  await initializeWasm();
  const module = getWasmModule();

  // No conversion needed - serde handles the field renaming
  const rustRootNode = rootNode;

  // One-shot WASM call
  const { regions, records, orphans } = module.runMdrFull(
    rustRootNode,
    K,
    T,
  ) as unknown as {
    regions: RegionsMapItem[];
    records: DataRecord[];
    orphans: TagNode[];
  };

  // Step 4: Combine records (avoiding duplicates)
  const finalRecords = [...records];
  const recordSet = new Set(
    records.filter((r): r is TagNode => !Array.isArray(r)).map((r) => r.xpath),
  );

  orphans.forEach((orphan) => {
    if (!recordSet.has(orphan.xpath)) {
      finalRecords.push(orphan);
    }
  });

  return { regions, records, orphans, finalRecords };
};

// Compatibility function for gradual migration
export const getNormalizedEditDistanceWASM = async (
  s1: string,
  s2: string,
): Promise<number> => {
  await initializeWasm();
  const module = getWasmModule();
  return module.getNormalizedEditDistance(s1, s2);
};

// Compatibility aliases for the old module interface
export { initializeWasm as initializeRustMDR };
export { getWasmModule as getRustMDRModule };

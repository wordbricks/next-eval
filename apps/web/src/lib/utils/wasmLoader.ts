// Utility for loading WASM module with better error handling and path resolution

export interface WasmModule {
  get_normalized_edit_distance_wasm: (s1: string, s2: string) => number;
  default: () => Promise<void>;
}

let wasmModule: WasmModule | null = null;
let wasmInitializationPromise: Promise<void> | null = null;

export const initializeWasm = async (): Promise<void> => {
  if (wasmModule) return;
  if (wasmInitializationPromise) return wasmInitializationPromise;

  wasmInitializationPromise = (async () => {
    try {
      // Dynamic import with Next.js basePath
      const importedModule = await import(
        /* webpackIgnore: true */
        "/next-eval/rust_mdr_pkg/rust_mdr_utils.js"
      ).catch((error) => {
        throw new Error(`Failed to load WASM module: ${error.message}`);
      });

      // Initialize Wasm (usually the default export)
      if (typeof importedModule.default === "function") {
        await importedModule.default();
      }

      wasmModule = importedModule as WasmModule;
    } catch (error) {
      console.error("Failed to initialize Wasm module:", error);
      wasmInitializationPromise = null; // Allow retry on next call
      throw new Error(
        `WASM initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  })();

  await wasmInitializationPromise;
};

export const getWasmModule = (): WasmModule => {
  if (!wasmModule) {
    throw new Error("Wasm module not initialized. Call initializeWasm first.");
  }
  return wasmModule;
};

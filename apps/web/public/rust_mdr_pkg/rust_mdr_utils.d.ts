/* tslint:disable */
/* eslint-disable */
/**
 * Initialize the WASM module (called automatically)
 */
export function init(): void;
/**
 * Run the MDR algorithm on a tag tree
 */
export function runMdrAlgorithm(
  root: any,
  k?: number | null,
  t?: number | null,
): any;
/**
 * Identify all data records from regions
 */
export function identifyAllDataRecords(
  regions_js: any,
  t: number,
  root: any,
): any;
/**
 * Find orphan records
 */
export function findOrphanRecords(regions_js: any, t: number, root: any): any;
/**
 * Calculate normalized edit distance between two strings (for testing/compatibility)
 */
export function getNormalizedEditDistance(s1: string, s2: string): number;
/**
 * Legacy function for compatibility with existing code
 */
export function get_normalized_edit_distance_wasm(
  s1: string,
  s2: string,
): number;
/**
 * Clear the distance cache between pages
 */
export function clearDistanceCache(): void;
/**
 * End-to-end MDR: regions → records → orphans in **one** bridge call.
 */
export function runMdrFull(
  root: any,
  k?: number | null,
  t?: number | null,
): any;

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init: () => void;
  readonly runMdrAlgorithm: (
    a: any,
    b: number,
    c: number,
  ) => [number, number, number];
  readonly identifyAllDataRecords: (
    a: any,
    b: number,
    c: any,
  ) => [number, number, number];
  readonly findOrphanRecords: (
    a: any,
    b: number,
    c: any,
  ) => [number, number, number];
  readonly getNormalizedEditDistance: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly clearDistanceCache: () => void;
  readonly runMdrFull: (
    a: any,
    b: number,
    c: number,
  ) => [number, number, number];
  readonly get_normalized_edit_distance_wasm: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;

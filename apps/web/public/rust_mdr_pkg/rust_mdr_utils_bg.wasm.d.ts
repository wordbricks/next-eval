/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const init: () => void;
export const runMdrAlgorithm: (
  a: any,
  b: number,
  c: number,
) => [number, number, number];
export const identifyAllDataRecords: (
  a: any,
  b: number,
  c: any,
) => [number, number, number];
export const findOrphanRecords: (
  a: any,
  b: number,
  c: any,
) => [number, number, number];
export const getNormalizedEditDistance: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const clearDistanceCache: () => void;
export const runMdrFull: (
  a: any,
  b: number,
  c: number,
) => [number, number, number];
export const get_normalized_edit_distance_wasm: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_export_4: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;

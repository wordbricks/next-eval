declare module "/rust_mdr_pkg/rust_mdr_utils.js" {
  export interface TagNode {
    tag_name: string;
    children: TagNode[];
    raw_text?: string;
    xpath: string;
  }

  export type DataRegion = [number, number, number]; // [gnLength, startIdx, nodeCount]

  export interface RegionsMapItem {
    parent_xpath: string;
    regions: DataRegion[];
  }

  export type DataRecord = TagNode | TagNode[];

  export function init(): void;

  export function runMdrAlgorithm(
    root: TagNode,
    k?: number,
    t?: number,
  ): RegionsMapItem[];

  export function identifyAllDataRecords(
    regions: RegionsMapItem[],
    t: number,
    root: TagNode,
  ): DataRecord[];

  export function findOrphanRecords(
    regions: RegionsMapItem[],
    t: number,
    root: TagNode,
  ): TagNode[];

  export function getNormalizedEditDistance(s1: string, s2: string): number;

  export function get_normalized_edit_distance_wasm(
    s1: string,
    s2: string,
  ): number;

  export default function __wbg_init(): Promise<void>;
}

declare module "/next-eval/rust_mdr_pkg/rust_mdr_utils.js" {
  export * from "/rust_mdr_pkg/rust_mdr_utils.js";
}

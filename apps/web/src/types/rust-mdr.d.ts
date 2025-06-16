declare module "*/rust_mdr_pkg/rust_mdr_utils.js" {
  export function get_normalized_edit_distance_wasm(
    s1: string,
    s2: string,
  ): number;
  export default function init(): Promise<void>;
}

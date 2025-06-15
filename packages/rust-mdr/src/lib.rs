mod types;
mod tree_utils;
mod similarity;
mod mdr_algorithm;
mod record_extraction;
mod wasm_bindings;

// Re-export public functions from wasm_bindings
pub use wasm_bindings::*;

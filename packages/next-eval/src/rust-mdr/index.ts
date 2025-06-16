// Export all rust-mdr functionality
// Note: The actual WASM module will be available in ./pkg after building
// Run 'bun run build' to generate the WASM bindings

// This will be available after build - ignore TypeScript errors until built
// @ts-ignore
export * from "./pkg/rust_mdr_utils";

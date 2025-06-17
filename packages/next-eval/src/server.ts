import "server-only";

// Server-side only exports for @wordbricks/next-eval
// These exports use Node.js APIs and should only be imported in server environments

// Re-export everything from the main index (client-safe exports)
export * from "./index";

// Server-only exports
export * from "./llm/prompts/getPrompt";
export * from "./llm/utils/getLLMResponse";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll } from "vitest";

// Setup for WASM in Node environment
beforeAll(() => {
  console.log("Running Vitest tests...");

  // Override fetch to handle file:// URLs for WASM loading
  const originalFetch = global.fetch;
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else if (input && typeof input === "object" && "url" in input) {
      url = input.url;
    } else {
      url = String(input);
    }

    // Handle WASM file requests regardless of URL format
    if (url.includes(".wasm") || url.includes("rust_mdr_utils_bg")) {
      let filePath: string;
      if (url.startsWith("file://")) {
        filePath = url.replace("file://", "");
      } else {
        // Always use the local WASM file path
        filePath = join(
          process.cwd(),
          "public",
          "rust_mdr_pkg",
          "rust_mdr_utils_bg.wasm",
        );
      }

      try {
        const wasmBuffer = readFileSync(filePath);
        // Convert Node.js Buffer to ArrayBuffer
        const arrayBuffer = wasmBuffer.buffer.slice(
          wasmBuffer.byteOffset,
          wasmBuffer.byteOffset + wasmBuffer.byteLength,
        );

        // Create a proper Response instance
        const response = new Response(arrayBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/wasm",
          },
        });

        return response;
      } catch (e) {
        console.error("Failed to load WASM file:", filePath, e);
        throw e;
      }
    }

    // Fall back to original fetch for other URLs
    if (originalFetch) {
      return originalFetch(input, init);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  // Preserve the preconnect property if it exists
  if ("preconnect" in originalFetch) {
    (customFetch as any).preconnect = (originalFetch as any).preconnect;
  }

  global.fetch = customFetch as typeof fetch;
});

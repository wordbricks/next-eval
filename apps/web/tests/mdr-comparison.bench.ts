import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runMDRWithDetails } from "@/lib/utils/runMDR";
import { slimHtml } from "@/lib/utils/slimHtml";
import { JSDOM } from "jsdom";
import { beforeAll, bench, describe } from "vitest";

describe("MDR Performance Benchmarks", () => {
  let sampleFiles: {
    name: string;
    content: string;
    slimmedContent: string;
    size: number;
  }[] = [];
  let filesBySize: {
    small: { name: string; content: string; slimmedContent: string }[];
    medium: { name: string; content: string; slimmedContent: string }[];
    large: { name: string; content: string; slimmedContent: string }[];
  };

  beforeAll(async () => {
    const samplesDir = join(process.cwd(), "public", "samples");
    const files = await readdir(samplesDir);
    const htmlFiles = files
      .filter((f) => f.endsWith(".html"))
      .sort((a, b) => {
        // Extract numbers from filenames for proper numerical sorting
        const numA = Number.parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = Number.parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });

    // Load ALL sample files
    sampleFiles = await Promise.all(
      htmlFiles.map(async (filename) => {
        const path = join(samplesDir, filename);
        const content = await readFile(path, "utf-8");
        // Use the web demo's approach: slim the HTML first using JSDOM
        const dom = new JSDOM(content);
        const slimmedContent = slimHtml(dom.window.document);
        return {
          name: filename,
          content,
          slimmedContent,
          size: slimmedContent.length,
        };
      }),
    );

    // Categorize files by slimmed size
    filesBySize = {
      small: sampleFiles.filter((f) => f.size < 10000),
      medium: sampleFiles.filter((f) => f.size >= 10000 && f.size < 50000),
      large: sampleFiles.filter((f) => f.size >= 50000),
    };

    console.log(`\nLoaded ${sampleFiles.length} sample files:`);
    console.log(`  Small (<10KB): ${filesBySize.small.length} files`);
    console.log(`  Medium (10-50KB): ${filesBySize.medium.length} files`);
    console.log(`  Large (>50KB): ${filesBySize.large.length} files`);

    // Warm up both implementations multiple times to ensure WASM is fully loaded
    console.log("\nWarming up implementations...");
    if (sampleFiles.length > 0) {
      for (let i = 0; i < 3; i++) {
        await runMDRWithDetails(sampleFiles[0].slimmedContent, false);
        await runMDRWithDetails(sampleFiles[0].slimmedContent, true);
      }
    }
    console.log("Warmup complete\n");
  });

  // Benchmark all files together
  bench(
    "All files - TypeScript MDR",
    async () => {
      for (const file of sampleFiles) {
        await runMDRWithDetails(file.slimmedContent, false);
      }
    },
    { iterations: 1 },
  );

  bench(
    "All files - Rust WASM MDR",
    async () => {
      for (const file of sampleFiles) {
        await runMDRWithDetails(file.slimmedContent, true);
      }
    },
    { iterations: 1 },
  );

  // Benchmark by size categories
  describe("By file size", () => {
    bench(
      "Small files (<10KB) - TypeScript",
      async () => {
        for (const file of filesBySize?.small || []) {
          await runMDRWithDetails(file.slimmedContent, false);
        }
      },
      { iterations: 3 },
    );

    bench(
      "Small files (<10KB) - Rust WASM",
      async () => {
        for (const file of filesBySize?.small || []) {
          await runMDRWithDetails(file.slimmedContent, true);
        }
      },
      { iterations: 3 },
    );

    bench(
      "Medium files (10-50KB) - TypeScript",
      async () => {
        for (const file of filesBySize?.medium || []) {
          await runMDRWithDetails(file.slimmedContent, false);
        }
      },
      { iterations: 2 },
    );

    bench(
      "Medium files (10-50KB) - Rust WASM",
      async () => {
        for (const file of filesBySize?.medium || []) {
          await runMDRWithDetails(file.slimmedContent, true);
        }
      },
      { iterations: 2 },
    );

    bench(
      "Large files (>50KB) - TypeScript",
      async () => {
        for (const file of filesBySize?.large || []) {
          await runMDRWithDetails(file.slimmedContent, false);
        }
      },
      { iterations: 1 },
    );

    bench(
      "Large files (>50KB) - Rust WASM",
      async () => {
        for (const file of filesBySize?.large || []) {
          await runMDRWithDetails(file.slimmedContent, true);
        }
      },
      { iterations: 1 },
    );
  });

  // Average performance benchmarks
  describe("Average performance per file", () => {
    bench(
      "Average file - TypeScript",
      async () => {
        if (sampleFiles.length > 0) {
          const randomFile =
            sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
          await runMDRWithDetails(randomFile.slimmedContent, false);
        }
      },
      { iterations: 20 },
    );

    bench(
      "Average file - Rust WASM",
      async () => {
        if (sampleFiles.length > 0) {
          const randomFile =
            sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
          await runMDRWithDetails(randomFile.slimmedContent, true);
        }
      },
      { iterations: 20 },
    );
  });
});

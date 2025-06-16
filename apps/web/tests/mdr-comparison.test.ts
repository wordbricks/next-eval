import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runMDRWithDetails } from "@/lib/utils/runMDR";
import { slimHtml } from "@next-eval/html-core/utils/slimHtml";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

describe("MDR TypeScript vs Rust Comparison", () => {
  let sampleFiles: { name: string; content: string }[] = [];

  beforeAll(async () => {
    const samplesDir = join(process.cwd(), "public", "samples");
    const files = await readdir(samplesDir);
    const htmlFiles = files.filter((f) => f.endsWith(".html")).sort();

    sampleFiles = await Promise.all(
      htmlFiles.map(async (filename) => {
        const path = join(samplesDir, filename);
        const content = await readFile(path, "utf-8");
        return { name: filename, content };
      }),
    );
  });

  describe("Output Comparison", () => {
    it("should produce identical results for all sample files", async () => {
      for (const { name, content } of sampleFiles) {
        console.log(`\nTesting ${name}...`);

        // Use the web demo's approach: slim the HTML first
        const dom = new JSDOM(content);
        const slimmedHtml = slimHtml(dom.window.document);

        const tsResult = await runMDRWithDetails(slimmedHtml, false);
        const rustResult = await runMDRWithDetails(slimmedHtml, true);

        console.log(
          `TypeScript: ${tsResult.xpaths.length} groups, ${tsResult.texts.length} texts`,
        );
        console.log(
          `Rust: ${rustResult.xpaths.length} groups, ${rustResult.texts.length} texts`,
        );

        if (tsResult.xpaths.length !== rustResult.xpaths.length) {
          console.log(
            "TypeScript XPaths:",
            JSON.stringify(tsResult.xpaths, null, 2),
          );
          console.log(
            "Rust XPaths:",
            JSON.stringify(rustResult.xpaths, null, 2),
          );
        }

        // 1. Check that XPaths are the same with order
        expect(rustResult.xpaths.length).toBe(tsResult.xpaths.length);

        for (let i = 0; i < tsResult.xpaths.length; i++) {
          const tsGroup = tsResult.xpaths[i];
          const rustGroup = rustResult.xpaths[i];

          expect(rustGroup.length).toBe(tsGroup.length);
          for (let j = 0; j < tsGroup.length; j++) {
            expect(rustGroup[j]).toBe(tsGroup[j]);
          }
        }

        // 2. Check that predicted texts are the same
        expect(rustResult.texts.length).toBe(tsResult.texts.length);
        for (let i = 0; i < tsResult.texts.length; i++) {
          expect(rustResult.texts[i]).toBe(tsResult.texts[i]);
        }

        // 3. Check that predicted records are the same
        expect(rustResult.records.length).toBe(tsResult.records.length);

        // Check record structure (single vs array)
        for (let i = 0; i < tsResult.records.length; i++) {
          const tsRecord = tsResult.records[i];
          const rustRecord = rustResult.records[i];

          // Check if both are arrays or both are single nodes
          expect(Array.isArray(rustRecord)).toBe(Array.isArray(tsRecord));

          if (Array.isArray(tsRecord) && Array.isArray(rustRecord)) {
            expect(rustRecord.length).toBe(tsRecord.length);
            for (let j = 0; j < tsRecord.length; j++) {
              expect(rustRecord[j].xpath).toBe(tsRecord[j].xpath);
              expect(rustRecord[j].rawText).toBe(tsRecord[j].rawText);
            }
          } else if (!Array.isArray(tsRecord) && !Array.isArray(rustRecord)) {
            expect(rustRecord.xpath).toBe(tsRecord.xpath);
            expect(rustRecord.rawText).toBe(tsRecord.rawText);
          }
        }

        console.log(`✓ ${name}: All checks passed`);
      }
    });
  });
});

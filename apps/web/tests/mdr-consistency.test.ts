import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runMDRWithDetails } from "@/lib/utils/runMDR";
import {
  type DOMParser,
  type TagNode,
  createDOMContext,
  slimHtml,
} from "@wordbricks/next-eval";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

// Create a jsdom parser for tests
const jsdomParser: DOMParser = (html: string) => {
  const dom = new JSDOM(html);
  return dom.window.document;
};

// Create a jsdom-based DOM context for consistent parsing
const jsdomContext = createDOMContext(jsdomParser);

type DataRecord = TagNode | TagNode[];

interface ExpectedResult {
  xpaths: string[][];
  texts: string[];
  records: DataRecord[];
}

describe("MDR Implementation Consistency Test", () => {
  const sampleFiles: Map<string, string> = new Map();
  const expectedResults: Map<string, ExpectedResult> = new Map();

  beforeAll(async () => {
    // Load sample files
    const samplesDir = join(process.cwd(), "public", "samples");
    const files = await readdir(samplesDir);
    const htmlFiles = files.filter((f) => f.endsWith(".html")).sort();

    // Load both HTML files and their corresponding expected results
    await Promise.all(
      htmlFiles.map(async (filename) => {
        // Load HTML content
        const htmlPath = join(samplesDir, filename);
        const content = await readFile(htmlPath, "utf-8");
        sampleFiles.set(filename, content);

        // Load corresponding expected result
        const jsonFilename = filename.replace(".html", ".json");
        const expectedPath = join(
          process.cwd(),
          "tests",
          "mdr-expected",
          jsonFilename,
        );
        try {
          const expectedContent = await readFile(expectedPath, "utf-8");
          const expectedResult = JSON.parse(expectedContent) as ExpectedResult;
          expectedResults.set(filename, expectedResult);
        } catch (error) {
          console.error(
            `Failed to load expected results for ${filename}:`,
            error,
          );
        }
      }),
    );
  });

  describe("MDR Consistency", () => {
    it("should produce consistent results matching the expected output", async () => {
      for (const [filename, content] of sampleFiles) {
        console.log(`\nTesting ${filename}...`);

        const expected = expectedResults.get(filename);
        if (!expected) {
          throw new Error(`No expected results found for ${filename}`);
        }

        // Preprocess HTML exactly as done in extraction script
        const dom = new JSDOM(content);
        const slimmedHtml = slimHtml(dom.window.document, jsdomContext);

        // Run MDR implementation with jsdom context
        const result = await runMDRWithDetails(slimmedHtml, jsdomContext);

        console.log(
          `Expected: ${expected.xpaths.length} groups, ${expected.texts.length} texts`,
        );
        console.log(
          `Actual: ${result.xpaths.length} groups, ${result.texts.length} texts`,
        );

        // 1. Check XPaths match exactly
        expect(result.xpaths.length).toBe(expected.xpaths.length);
        for (let i = 0; i < expected.xpaths.length; i++) {
          expect(result.xpaths[i]).toEqual(expected.xpaths[i]);
        }

        // 2. Check texts match exactly
        expect(result.texts.length).toBe(expected.texts.length);
        for (let i = 0; i < expected.texts.length; i++) {
          expect(result.texts[i]).toBe(expected.texts[i]);
        }

        // 3. Check records structure matches
        expect(result.records.length).toBe(expected.records.length);
        for (let i = 0; i < expected.records.length; i++) {
          const expectedRecord = expected.records[i];
          const actualRecord = result.records[i];

          // Check if both are arrays or both are single nodes
          expect(Array.isArray(actualRecord)).toBe(
            Array.isArray(expectedRecord),
          );

          if (Array.isArray(expectedRecord) && Array.isArray(actualRecord)) {
            expect(actualRecord.length).toBe(expectedRecord.length);
            for (let j = 0; j < expectedRecord.length; j++) {
              expect(actualRecord[j].xpath).toBe(expectedRecord[j].xpath);
              expect(actualRecord[j].rawText).toBe(expectedRecord[j].rawText);
            }
          } else if (
            !Array.isArray(expectedRecord) &&
            !Array.isArray(actualRecord)
          ) {
            expect(actualRecord.xpath).toBe(expectedRecord.xpath);
            expect(actualRecord.rawText).toBe(expectedRecord.rawText);
          }
        }

        console.log(`✓ ${filename}: All checks passed`);
      }
    });
  });
});

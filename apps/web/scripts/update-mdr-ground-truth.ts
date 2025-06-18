import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runMDRWithDetails } from "@/lib/utils/runMDR";
import {
  type DOMParser,
  createDOMContext,
  slimHtml,
} from "@wordbricks/next-eval";
import { JSDOM } from "jsdom";

// Create a jsdom parser for this script
const jsdomParser: DOMParser = (html: string) => {
  const dom = new JSDOM(html);
  return dom.window.document;
};

// Create a jsdom-based DOM context for consistent parsing
const jsdomContext = createDOMContext(jsdomParser);

/**
 * Run this script when:
 * - The MDR algorithm has been updated and produces different (but correct) results
 * - New HTML samples are added that need expected results
 * - You want to establish a new baseline for MDR consistency testing
 */
async function regenerateMDRExpected() {
  const samplesDir = join(process.cwd(), "public", "samples");
  const outputDir = join(process.cwd(), "tests", "mdr-expected");

  const files = await readdir(samplesDir);
  const htmlFiles = files.filter((f) => f.endsWith(".html")).sort();

  console.log(
    `Regenerating expected results for ${htmlFiles.length} files...\n`,
  );

  for (const filename of htmlFiles) {
    console.log(`Processing ${filename}...`);

    const path = join(samplesDir, filename);
    const content = await readFile(path, "utf-8");

    // Use jsdom throughout for consistent parsing
    const dom = new JSDOM(content);
    const slimmedHtml = slimHtml(dom.window.document, jsdomContext);

    // Run current Rust MDR implementation with jsdom context
    const result = await runMDRWithDetails(slimmedHtml, jsdomContext);

    console.log(
      `  Found ${result.xpaths.length} groups, ${result.texts.length} texts`,
    );

    // Save to individual file
    const outputFilename = filename.replace(".html", ".json");
    const outputPath = join(outputDir, outputFilename);

    const data = {
      xpaths: result.xpaths,
      texts: result.texts,
      records: result.records,
    };

    await writeFile(outputPath, JSON.stringify(data, null, 2));
    console.log(`  Saved to ${outputFilename}`);
  }

  console.log(
    `\nCompleted! Regenerated ${htmlFiles.length} expected result files.`,
  );
}

// Run the regeneration
regenerateMDRExpected().catch(console.error);

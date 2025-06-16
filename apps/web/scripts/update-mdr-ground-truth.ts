import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runMDRWithDetails } from "@/lib/utils/runMDR";
import { slimHtml } from "@next-eval/html-core/utils/slimHtml";
import { JSDOM } from "jsdom";

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

    // Use the same preprocessing as the test
    const dom = new JSDOM(content);
    const slimmedHtml = slimHtml(dom.window.document);

    // Run current Rust MDR implementation
    const result = await runMDRWithDetails(slimmedHtml, true);

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

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runMDRWithDetails } from "@/lib/utils/runMDR";
import { pipe } from "@fxts/core";
import { type DOMParser, createProcessor } from "@wordbricks/next-eval";
import { JSDOM } from "jsdom";

/**
 * Run this script when:
 * - The MDR algorithm has been updated and produces different (but correct) results
 * - New HTML samples are added that need expected results
 * - You want to establish a new baseline for MDR consistency testing
 */
async function regenerateMDRExpected() {
  const jsdomParser: DOMParser = (html: string) => {
    const dom = new JSDOM(html);
    return dom.window.document;
  };

  const p = createProcessor({ parser: jsdomParser });

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

    const slimmedHtml = pipe(
      content,
      p.parseHtml,
      p.slimDocument,
      (result) => result.slimmedHtml,
    );

    const result = await runMDRWithDetails(slimmedHtml, p.context);

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

regenerateMDRExpected().catch(console.error);

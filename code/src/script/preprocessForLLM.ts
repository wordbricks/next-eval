import fs from "node:fs";
import path from "node:path";
import { DATA_PATH } from "../constant";
import { getHTMLAndTextMapFromMHTML } from "../utils";

const main = async () => {
	const allUrls = fs.readdirSync(DATA_PATH);

	for (const url of allUrls) {
		if (url === "results" || url === ".DS_Store") {
			continue;
		}
		const dirPath = path.join(DATA_PATH, url);
		const mhtmlPath = path.join(dirPath, "syn.mhtml");
		const outputPath = path.join(dirPath, "cleaned.html");
		const textMapPath = path.join(dirPath, "text_map.json");
		const textMapFlatPath = path.join(dirPath, "text_map_flat.json");
		try {
			const { html: cleanedHtml, textMap, textMapFlat } = await getHTMLAndTextMapFromMHTML(mhtmlPath);
			fs.writeFileSync(outputPath, cleanedHtml);
			fs.writeFileSync(textMapPath, JSON.stringify(textMap, null, 2));
			fs.writeFileSync(textMapFlatPath, JSON.stringify(textMapFlat, null, 2));

			console.log(`Processing ${url}: Completed file operations.`);

		} catch (err) {
			console.error(`Error processing ${url}:`, err);
		}
	}
	console.log("\nAll processing finished.");
};

main().catch(console.error);

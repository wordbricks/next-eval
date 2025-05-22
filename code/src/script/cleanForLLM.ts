import fs from "node:fs";
import path from "node:path";
import { DATA_PATH } from "../constant";
import { getHTMLAndTextMapFromMHTML, slugifyUrl } from "../utils";

interface OperationStatus {
	url: string;
	mhtml: number;
	screenshot: number;
	html: number;
}

const processRecords = async () => {
	const csvFilePath = path.join(DATA_PATH, "results/operation_status.csv");
	const fileContent = fs.readFileSync(csvFilePath, "utf-8");

	const lines = fileContent.split("\n").filter((line) => line.trim());
	const dataLines = lines.slice(1);
	const records: OperationStatus[] = dataLines.map((line) => {
		const [url, mhtml, screenshot, html] = line.split(",");
		return {
			url,
			mhtml: Number.parseInt(mhtml, 10),
			screenshot: Number.parseInt(screenshot, 10),
			html: Number.parseInt(html, 10),
		};
	});

	for (const record of records) {
		if (record.mhtml === 0 || record.screenshot === 0 || record.html === 0)
			continue;
		const slugName = slugifyUrl(record.url);
		const dirPath = path.join(DATA_PATH, slugName);
		const mhtmlPath = path.join(dirPath, "syn.mhtml");
		const outputPath = path.join(dirPath, "cleaned.html");
		const textMapPath = path.join(dirPath, "text_map.json");
		const textMapFlatPath = path.join(dirPath, "text_map_flat.json");
		try {
			const { html: cleanedHtml, textMap, textMapFlat } = await getHTMLAndTextMapFromMHTML(mhtmlPath);
			fs.writeFileSync(outputPath, cleanedHtml);
			fs.writeFileSync(textMapPath, JSON.stringify(textMap, null, 2));
			fs.writeFileSync(textMapFlatPath, JSON.stringify(textMapFlat, null, 2));

			console.log(`Processing ${slugName}: Completed file operations.`);

		} catch (err) {
			console.error(`Error processing ${slugName}:`, err);
		}
	}

	console.log("\nAll processing finished.");
};

// Run the processing
processRecords().catch(console.error);

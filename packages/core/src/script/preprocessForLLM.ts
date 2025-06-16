import fs from "node:fs";
import path from "node:path";
import { SYN_DATA_PATH } from "@next-eval/core/constant";
import { getHTMLAndTextMapFromMHTML } from "@next-eval/core/utils/getHTMLAndTextMapFromMHTML";

const main = async () => {
  const flatDstDirPath = path.join(SYN_DATA_PATH, "flat");
  const hierDstDirPath = path.join(SYN_DATA_PATH, "hier");
  const slimDstDirPath = path.join(SYN_DATA_PATH, "slim");
  const mhtmlDstDirPath = path.join(SYN_DATA_PATH, "mhtml");

  for (let index = 1; index <= 164; index++) {
    const mhtmlPath = path.join(mhtmlDstDirPath, `${index}.mhtml`);
    const slimPath = path.join(slimDstDirPath, `${index}.html`);
    const hierPath = path.join(hierDstDirPath, `${index}.json`);
    const flatPath = path.join(flatDstDirPath, `${index}.json`);

    const {
      html: cleanedHtml,
      textMap,
      textMapFlat,
    } = await getHTMLAndTextMapFromMHTML(mhtmlPath);
    fs.writeFileSync(slimPath, cleanedHtml);
    fs.writeFileSync(hierPath, JSON.stringify(textMap, null, 2));
    fs.writeFileSync(flatPath, JSON.stringify(textMapFlat, null, 2));
    console.log(`Processing ${index}: Completed file operations.`);
  }
  console.log("\nAll processing finished.");
};

main().catch(console.error);

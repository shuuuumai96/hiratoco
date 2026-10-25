import {mkdir, readFile, writeFile} from "node:fs/promises";
import {chromium} from "playwright";

// Rasterize the existing project artwork; packaging uses the committed PNGs
// and does not need a browser. PLAYWRIGHT_BROWSERS_PATH selects its cache.
const sizes = [16, 32, 48, 128];
const source = await readFile(new URL("../extension/icons/launcher.svg", import.meta.url), "utf8");
const directory = new URL("./chromium-icons/", import.meta.url);
const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage();
  await mkdir(directory, {recursive: true});
  for (const size of sizes) {
    const base64 = await page.evaluate(async ({source, size}) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(source)}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    }, {source, size});
    await writeFile(new URL(`launcher-${size}.png`, directory), Buffer.from(base64, "base64"));
  }
} finally {
  await browser.close();
}

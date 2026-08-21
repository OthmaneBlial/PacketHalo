import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const outputDirectory = process.argv[2];
if (!outputDirectory)
  throw new Error("Usage: node scripts/capture-demo.mjs OUTPUT_DIRECTORY");
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 960, height: 540 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:5173/");
await page.waitForTimeout(2_400);
for (let frame = 0; frame < 28; frame += 1) {
  if (frame === 16)
    await page.getByRole("button", { name: "Globe mode" }).click();
  await page.screenshot({
    path: `${outputDirectory}/${String(frame).padStart(3, "0")}.png`,
  });
  await page.waitForTimeout(150);
}
await browser.close();

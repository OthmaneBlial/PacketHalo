import { mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

const observatoryUrl =
  process.env.PACKETHALO_CAPTURE_URL || "http://127.0.0.1:8080";
const controlUrl =
  process.env.PACKETHALO_CAPTURE_CONTROL_URL || "http://127.0.0.1:8081";
const outputDirectory = new URL("../docs/assets/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
try {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  await desktop.goto(observatoryUrl, { waitUntil: "networkidle" });
  // Chromium can use the oversized transformed canvas as the screenshot
  // compositor origin. Keep the production overscan intact while making the
  // documentation capture represent the complete viewport.
  await desktop.addStyleTag({
    content:
      ".sky-canvas{inset:0!important;width:100%!important;height:100%!important;transform:none!important}",
  });
  await desktop.getByRole("button", { name: "Forensic mode" }).click();
  await desktop.waitForFunction(
    () => Number(document.querySelector("main")?.dataset.activeFlows || 0) > 4,
  );
  await desktop.waitForTimeout(1_800);
  await desktop.screenshot({
    path: new URL("forensic.png", outputDirectory).pathname,
  });

  const mobile = await browser.newPage({ ...devices["Pixel 7"] });
  await mobile.goto(observatoryUrl, { waitUntil: "networkidle" });
  await mobile.waitForFunction(
    () => Number(document.querySelector("main")?.dataset.activeFlows || 0) > 2,
  );
  await mobile.waitForTimeout(1_200);
  await mobile.screenshot({
    path: new URL("mobile-observatory.png", outputDirectory).pathname,
  });

  const controller = await browser.newPage({ ...devices["Pixel 7"] });
  await controller.goto(controlUrl, { waitUntil: "networkidle" });
  await controller.getByText("connected", { exact: true }).waitFor();
  await controller.screenshot({
    path: new URL("control-mobile.png", outputDirectory).pathname,
    fullPage: true,
  });
} finally {
  await browser.close();
}

console.log(
  "Captured forensic, mobile observatory, and phone control documentation screens.",
);

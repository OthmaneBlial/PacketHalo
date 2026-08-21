import { expect, test } from "@playwright/test";

test("starts immediately in a living simulator scene", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Movie night" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByText("Packet contents are never inspected."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Live summary").getByText("connections"),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        (
          await page
            .getByLabel("Live summary")
            .locator(".metric strong")
            .first()
            .textContent()
        )?.replaceAll(",", ""),
      ),
    )
    .toBeGreaterThan(0);
});

test("switches scene, mode, pause, speed, and theme live", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Movie night/ }).click();
  await page.getByRole("button", { name: /Developer laptop/ }).click();
  await expect(
    page.getByRole("heading", { name: "Developer laptop" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Globe mode" }).click();
  if (testInfo.project.name === "desktop-chromium") {
    await page.getByRole("button", { name: "×0.25", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "×0.25", exact: true }),
    ).toHaveClass(/active/);
  }
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await expect(page.getByText("Observation paused")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay recording" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jump to next event" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("button", { name: "Aurora" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-theme", "aurora");
});

test("records, exports, and imports a metadata-only session", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  await page.getByRole("button", { name: "Record session" }).click();
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Open controls" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("accepts live simulator direction from the phone controller", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  const controller = await page.context().newPage();
  await controller.goto("http://127.0.0.1:5174/");
  await expect(
    controller.getByText("connected", { exact: true }),
  ).toBeVisible();
  await controller.getByLabel("Simulator scene").selectOption("netflix");
  await expect(
    page.getByRole("heading", { name: "Netflix premiere" }),
  ).toBeVisible();
  await controller.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Observation paused")).toBeVisible();
  await controller.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByText("Live local simulation")).toBeVisible();
  await controller.close();
});

test("is keyboard reachable and honors the ambient instrument reveal", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("m");
  await page.keyboard.press("c");
  await expect(
    page.getByRole("button", { name: /Reveal instruments/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Reveal instruments/ }).click();
  await expect(page.getByLabel("Playback and display controls")).toBeVisible();
});

test("keeps its primary controls inside a phone viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.goto("/");
  const dock = page.getByLabel("Playback and display controls");
  const box = await dock.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
});

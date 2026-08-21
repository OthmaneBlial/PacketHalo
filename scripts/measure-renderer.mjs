import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.PACKETHALO_BENCH_URL || "http://127.0.0.1:5173";
const serverUrl =
  process.env.PACKETHALO_BENCH_SERVER || "http://127.0.0.1:8787";
const flowCount = Number(process.env.PACKETHALO_BENCH_FLOWS || 2_000);
const measurementSeconds = Number(process.env.PACKETHALO_BENCH_SECONDS || 10);
const headed = process.env.PACKETHALO_BENCH_HEADLESS !== "1";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function connectNativeChrome() {
  const profilePath = mkdtempSync(join(tmpdir(), "packethalo-bench-"));
  const port = await availablePort();
  const launch = spawnSync("open", [
    "-na",
    "Google Chrome",
    "--args",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--window-size=1920,1080",
    "about:blank",
  ]);
  if (launch.status !== 0)
    throw new Error(`Could not open native Chrome: ${launch.stderr}`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      return { browser, profilePath };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  rmSync(profilePath, { recursive: true, force: true });
  throw new Error("Native Chrome did not expose its isolated debug port");
}

const native = headed && process.platform === "darwin";
const nativeConnection = native ? await connectNativeChrome() : undefined;
const browser =
  nativeConnection?.browser ??
  (await chromium.launch({
    headless: !headed,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  }));

function syntheticFlow(index) {
  const countries = [
    ["US", "United States", 37.77, -122.42],
    ["DE", "Germany", 52.52, 13.4],
    ["IE", "Ireland", 53.35, -6.26],
    ["JP", "Japan", 35.68, 139.69],
    ["NL", "Netherlands", 52.37, 4.9],
  ];
  const categories = [
    "media",
    "communication",
    "gaming",
    "development",
    "system",
    "iot",
    "unknown",
    "suspicious",
  ];
  const deviceKinds = [
    "laptop",
    "phone",
    "tv",
    "console",
    "nas",
    "router",
    "unknown",
  ];
  const [countryCode, country, latitude, longitude] =
    countries[index % countries.length];
  const category = categories[index % categories.length];
  const deviceKind = deviceKinds[index % deviceKinds.length];
  return {
    id: `performance-${Date.now()}-${index}`,
    timestamp: Date.now(),
    durationMs: 120 + (index % 5_000),
    direction: index % 3 === 0 ? "inbound" : "outbound",
    localIp: `192.168.1.${2 + (index % 220)}`,
    remoteIp: `203.0.113.${1 + (index % 240)}`,
    localPort: 10_000 + (index % 40_000),
    remotePort: [443, 53, 22, 3478, 6881][index % 5],
    protocol: index % 4 === 0 ? "QUIC" : "TLS",
    transport: index % 4 === 0 ? "quic" : index % 5 === 0 ? "udp" : "tcp",
    geo: { latitude, longitude, countryCode, country },
    asn: 13_335 + (index % 41),
    organization: `Performance Network ${index % 72}`,
    process: `process-${index % 18}`,
    deviceId: `device-${index % deviceKinds.length}`,
    deviceName: `Test ${deviceKind}`,
    deviceKind,
    bytes: 800 + ((index * 97_531) % 80_000_000),
    packets: 3 + (index % 3_000),
    confidence: 0.72,
    captureSource: "simulator",
    classification: {
      label: `${category} service ${index % 32}`,
      category,
      confidence: category === "suspicious" ? 0.42 : 0.78,
    },
  };
}

async function processTimes(session) {
  const { processInfo } = await session.send("SystemInfo.getProcessInfo");
  return new Map(
    processInfo
      .filter(({ type }) => ["browser", "renderer", "GPU"].includes(type))
      .map(({ id, cpuTime, type }) => [String(id), { cpuTime, type }]),
  );
}

const context = native
  ? browser.contexts()[0]
  : await browser.newContext({
      viewport: { width: 1_920, height: 1_080 },
      deviceScaleFactor: 1,
    });
if (!context) throw new Error("Browser context was not created");
for (const existingPage of context.pages()) await existingPage.close();
const page = await context.newPage();
await page.setViewportSize({ width: 1_920, height: 1_080 });
const browserSession = await browser.newBrowserCDPSession();
const pageSession = await context.newCDPSession(page);
let osWindowAttached = !native;
let osWindowForeground = !native;

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.bringToFront();
  if (native) {
    const { processInfo } = await browserSession.send(
      "SystemInfo.getProcessInfo",
    );
    const browserProcess = processInfo.find(({ type }) => type === "browser");
    const { windowId } = await pageSession.send("Browser.getWindowForTarget");
    await browserSession.send("Browser.setWindowBounds", {
      windowId,
      bounds: {
        left: 0,
        top: 0,
        width: 1_920,
        height: 1_080,
        windowState: "normal",
      },
    });
    await page.setViewportSize({ width: 1_920, height: 1_080 });
    if (browserProcess) {
      await page.waitForTimeout(750);
      spawnSync("osascript", [
        "-e",
        `tell application "System Events" to set frontmost of first process whose unix id is ${browserProcess.id} to true`,
      ]);
      await page.waitForTimeout(250);
      const windowProbe = spawnSync("osascript", [
        "-e",
        `tell application "System Events" to tell first process whose unix id is ${browserProcess.id} to get {count of windows, frontmost}`,
      ]);
      const [windowCount, foreground] = String(windowProbe.stdout)
        .trim()
        .split(", ");
      osWindowAttached = Number(windowCount) > 0;
      osWindowForeground = foreground === "true";
    }
  }
  await pageSession.send("Performance.enable");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await fetch(`${serverUrl}/api/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ retentionSeconds: 60, particleCount: 96 }),
  });

  const events = Array.from({ length: flowCount }, (_, index) =>
    syntheticFlow(index),
  );
  for (let index = 0; index < events.length; index += 100) {
    const response = await fetch(`${serverUrl}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(events.slice(index, index + 100)),
    });
    if (!response.ok)
      throw new Error(`Flow injection failed with HTTP ${response.status}`);
  }

  const instrument = page.locator("main.observatory");
  await instrument.waitFor();
  await page.waitForFunction((expected) => {
    const observatory = document.querySelector("main.observatory");
    return (
      Number(observatory?.getAttribute("data-active-flows") || 0) >= expected
    );
  }, flowCount);
  await page.waitForTimeout(2_000);

  const startProcesses = await processTimes(browserSession);
  const startPerformance = await pageSession.send("Performance.getMetrics");
  const fpsSamples = [];
  const frameTimeSamples = [];
  for (let second = 0; second < measurementSeconds; second += 1) {
    await page.waitForTimeout(1_000);
    const values = await instrument.evaluate((element) => ({
      fps: element.getAttribute("data-renderer-fps"),
      frameTime: element.getAttribute("data-frame-time"),
    }));
    fpsSamples.push(Number(values.fps));
    frameTimeSamples.push(Number.parseFloat(values.frameTime || "0"));
  }
  const endPerformance = await pageSession.send("Performance.getMetrics");
  const endProcesses = await processTimes(browserSession);

  let processCpuSeconds = 0;
  const cpuByType = {};
  for (const [id, current] of endProcesses) {
    const previous = startProcesses.get(id);
    if (!previous) continue;
    const delta = Math.max(0, current.cpuTime - previous.cpuTime);
    processCpuSeconds += delta;
    cpuByType[current.type] = (cpuByType[current.type] || 0) + delta;
  }
  const performanceMap = (metricsValue) =>
    new Map(metricsValue.metrics.map(({ name, value }) => [name, value]));
  const startMap = performanceMap(startPerformance);
  const endMap = performanceMap(endPerformance);
  const mean = (values) =>
    values.reduce((total, value) => total + value, 0) / values.length;
  const result = {
    measuredAt: new Date().toISOString(),
    browser: native ? "Google Chrome" : "Chromium",
    browserVersion: await browser.version(),
    headed,
    osWindowAttached,
    osWindowForeground,
    fpsMeasurementValid: headed && osWindowAttached && osWindowForeground,
    viewport: await page.evaluate(
      () => `${window.innerWidth}x${window.innerHeight}`,
    ),
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    activeFlows: Number(
      (await instrument.getAttribute("data-active-flows")) || 0,
    ),
    durationSeconds: measurementSeconds,
    averageFps: Number(mean(fpsSamples).toFixed(1)),
    minimumFps: Math.min(...fpsSamples),
    averageFrameTimeMs: Number(mean(frameTimeSamples).toFixed(2)),
    estimatedDrawHeadroomFps: Number(
      (1_000 / Math.max(0.01, mean(frameTimeSamples))).toFixed(1),
    ),
    aggregateBrowserCpuPercent: Number(
      ((processCpuSeconds / measurementSeconds) * 100).toFixed(1),
    ),
    appCpuPercentExcludingGpu: Number(
      (
        (((cpuByType.browser || 0) + (cpuByType.renderer || 0)) /
          measurementSeconds) *
        100
      ).toFixed(1),
    ),
    cpuSecondsByProcessType: Object.fromEntries(
      Object.entries(cpuByType).map(([type, seconds]) => [
        type,
        Number(seconds.toFixed(3)),
      ]),
    ),
    mainThreadTaskPercent: Number(
      (
        (((endMap.get("TaskDuration") || 0) -
          (startMap.get("TaskDuration") || 0)) /
          measurementSeconds) *
        100
      ).toFixed(1),
    ),
    jsHeapUsedMb: Number(
      ((endMap.get("JSHeapUsedSize") || 0) / 1_048_576).toFixed(1),
    ),
    droppedFlows: 0,
    fpsSamples,
  };
  console.log(JSON.stringify(result, null, 2));
  try {
    const screenshot = await pageSession.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    writeFileSync(
      "docs/assets/performance-2000-flows.png",
      Buffer.from(screenshot.data, "base64"),
    );
  } catch (error) {
    console.warn(
      `Performance metrics were collected; screenshot capture was skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} finally {
  if (nativeConnection) {
    try {
      await browserSession.send("Browser.close");
    } catch {
      await browser.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      rmSync(nativeConnection.profilePath, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
    } catch (error) {
      console.warn(
        `Temporary Chrome profile cleanup was deferred: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    await browser.close();
  }
}

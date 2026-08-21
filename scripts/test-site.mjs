import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { once } from "node:events";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const siteDirectory = resolve(process.cwd(), "site");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    );
    if (pathname === "/PacketHalo") {
      response.writeHead(308, { location: "/PacketHalo/" }).end();
      return;
    }
    if (!pathname.startsWith("/PacketHalo/")) {
      response.writeHead(404).end("Not found");
      return;
    }
    const relativePath = pathname.slice("/PacketHalo/".length) || "index.html";
    let filePath = resolve(siteDirectory, relativePath);
    if (
      filePath !== siteDirectory &&
      !filePath.startsWith(`${siteDirectory}${sep}`)
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if ((await stat(filePath)).isDirectory())
      filePath = resolve(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type":
        contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert(
  address && typeof address !== "string",
  "Static site server did not bind a TCP port.",
);
const baseUrl = `http://127.0.0.1:${address.port}/PacketHalo/`;
const browser = await chromium.launch();

async function assertAccessible(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  if (results.violations.length > 0) {
    const summary = results.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.nodes
            .map(
              (node) =>
                `${node.target.join(" ")} (${node.failureSummary || "failed"})`,
            )
            .join("; ")}`,
      )
      .join(" | ");
    throw new Error(`${label} accessibility violations: ${summary}`);
  }
}

async function createPage(viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "dark",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    errors.push(`${request.method()} ${request.url()} failed`),
  );
  return { context, page, errors };
}

try {
  for (const target of [
    "index.html",
    "docs.html",
    "styles.css",
    "app.js",
    "assets/hero.png",
    "reference/privacy.md",
  ]) {
    const response = await fetch(new URL(target, baseUrl));
    assert(response.ok, `${target} returned HTTP ${response.status}`);
  }

  const desktop = await createPage({ width: 1440, height: 900 });
  await desktop.page.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.page.evaluate(() => document.fonts.ready);
  assert(
    await desktop.page
      .getByRole("heading", { name: /Your network is already speaking/i })
      .isVisible(),
    "Desktop hero heading is not visible.",
  );
  await desktop.page.getByRole("button", { name: /Developer laptop/i }).click();
  assert(
    (await desktop.page.locator("[data-scene-status]").textContent())?.includes(
      "Developer Laptop",
    ),
    "Scene selection did not update the live preview.",
  );
  const motion = desktop.page.locator("[data-motion-toggle]");
  await motion.click();
  assert(
    (await motion.getAttribute("aria-pressed")) === "true",
    "Pause control did not update.",
  );
  await desktop.page.locator('[data-copy="quick-command"]').click();
  const clipboard = await desktop.page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  assert(
    clipboard.includes("git clone") && clipboard.includes("pnpm dev"),
    "Quick-start copy is incomplete.",
  );
  const brokenImages = await desktop.page
    .locator("img")
    .evaluateAll((images) =>
      images
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.src),
    );
  assert(
    brokenImages.length === 0,
    `Broken desktop images: ${brokenImages.join(", ")}`,
  );
  assert(
    await desktop.page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Desktop landing page overflows horizontally.",
  );
  await assertAccessible(desktop.page, "Desktop landing page");
  assert(
    desktop.errors.length === 0,
    `Desktop landing errors: ${desktop.errors.join(" | ")}`,
  );
  await desktop.context.close();

  const docs = await createPage({ width: 1280, height: 900 });
  await docs.page.goto(new URL("docs.html", baseUrl).href, {
    waitUntil: "networkidle",
  });
  await docs.page.evaluate(() => document.fonts.ready);
  await docs.page.locator("[data-doc-search]").fill("Docker");
  assert(
    (await docs.page.locator(".doc-section:visible").count()) > 0,
    "Docs search hid every section.",
  );
  assert(
    (await docs.page.locator(".doc-section[hidden]").count()) > 0,
    "Docs search did not filter sections.",
  );
  await docs.page.locator("[data-doc-search]").fill("");
  await docs.page.locator("details").first().locator("summary").click();
  assert(
    await docs.page
      .locator("details")
      .first()
      .evaluate((element) => element.open),
    "Troubleshooting disclosure did not open.",
  );
  await docs.page.locator('[data-copy="docs-docker"]').click();
  const dockerClipboard = await docs.page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  assert(
    dockerClipboard.trim() === "docker compose up --build",
    "Docker copy control is incorrect.",
  );
  await assertAccessible(docs.page, "Documentation page");
  assert(
    docs.errors.length === 0,
    `Documentation errors: ${docs.errors.join(" | ")}`,
  );
  await docs.context.close();

  const mobile = await createPage({ width: 390, height: 844 });
  await mobile.page.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.page.getByRole("button", { name: "Menu" }).click();
  assert(
    await mobile.page.getByRole("link", { name: "Documentation" }).isVisible(),
    "Mobile menu did not open.",
  );
  const mobileOverflow = await mobile.page.evaluate(() => ({
    page: [document.documentElement.scrollWidth, window.innerWidth],
    elements: [...document.querySelectorAll("body *")]
      .map((element) => ({
        selector: `${element.tagName.toLowerCase()}.${element.className}`,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
      .slice(0, 12),
  }));
  assert(
    mobileOverflow.page[0] <= mobileOverflow.page[1] + 1,
    `Mobile landing page overflows horizontally: ${JSON.stringify(mobileOverflow)}`,
  );
  await assertAccessible(mobile.page, "Mobile landing page");
  assert(
    mobile.errors.length === 0,
    `Mobile landing errors: ${mobile.errors.join(" | ")}`,
  );
  await mobile.context.close();

  console.log(
    "Static site browser verification passed: subpath assets, scenes, copy controls, docs search, disclosure, desktop/mobile overflow, console/network, and WCAG A/AA checks.",
  );
} finally {
  await browser.close();
  server.close();
  await once(server, "close");
}

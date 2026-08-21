import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const site = resolve(root, "site");
const failures = [];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const files = walk(site);
const htmlFiles = files.filter((file) => extname(file) === ".html");
const idsByFile = new Map(
  htmlFiles.map((file) => {
    const source = readFileSync(file, "utf8");
    return [
      file,
      new Set([...source.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])),
    ];
  }),
);

function inspectTarget(sourceFile, rawTarget) {
  if (!rawTarget || /^(?:https?:|mailto:|tel:|data:|#|%23)/.test(rawTarget))
    return;
  if (rawTarget.startsWith("/")) {
    failures.push(
      `${sourceFile}: root-relative URL is not subpath-safe: ${rawTarget}`,
    );
    return;
  }
  const [pathPart, anchor] = rawTarget.split("#", 2);
  let target = sourceFile;
  if (pathPart)
    target = resolve(sourceFile, "..", decodeURIComponent(pathPart));
  if (!existsSync(target)) {
    failures.push(`${sourceFile}: missing target ${rawTarget}`);
    return;
  }
  if (
    anchor &&
    extname(target) === ".html" &&
    !idsByFile.get(target)?.has(anchor)
  )
    failures.push(`${sourceFile}: missing anchor ${rawTarget}`);
}

for (const file of files) {
  const extension = extname(file);
  if (extension !== ".html" && extension !== ".css") continue;
  const source = readFileSync(file, "utf8");
  const targets =
    extension === ".html"
      ? [...source.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1])
      : [...source.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
          (match) => match[1],
        );
  for (const target of targets) inspectTarget(file, target);
}

for (const required of [
  "index.html",
  "docs.html",
  "styles.css",
  "app.js",
  "assets/hero.png",
])
  if (!existsSync(resolve(site, required)))
    failures.push(`site: missing required file ${required}`);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Portable site verified: ${files.length} files, ${htmlFiles.length} HTML pages, no broken local or root-relative URLs.`,
);

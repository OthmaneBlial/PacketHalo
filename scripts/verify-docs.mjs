import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const root = process.cwd();
const documents = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  ...readdirSync(resolve(root, "docs"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `docs/${name}`),
  ...readdirSync(resolve(root, "appliance"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `appliance/${name}`),
];
const failures = [];

for (const document of documents) {
  if (!existsSync(resolve(root, document))) continue;
  const source = readFileSync(resolve(root, document), "utf8");
  const targets = [
    ...source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
    ...source.matchAll(/(?:href|src)="([^"]+)"/g),
  ].map((match) => match[1]);
  for (const rawTarget of targets) {
    if (!rawTarget || /^(?:https?:|mailto:|#)/.test(rawTarget)) continue;
    const target = decodeURIComponent(rawTarget.split("#", 1)[0]);
    const absolute = resolve(root, dirname(document), target);
    const relativeTarget = relative(root, absolute);
    if (
      relativeTarget === ".." ||
      relativeTarget.startsWith(`..${sep}`) ||
      !existsSync(absolute)
    )
      failures.push(`${document}: missing local target ${rawTarget}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Documentation links verified across ${documents.length} files.`);

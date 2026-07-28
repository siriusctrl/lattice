import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const roots = ["app", "docs", "README.md", "AGENTS.md"];
const textExtensions = new Set([".ts", ".tsx", ".css", ".md"]);
const forbidden = [
  ["em dash", "—"],
  ["en dash", "–"],
  ["starter preview marker", "codex-preview"],
  ["starter title", "Your site is taking shape"],
];

async function collect(path) {
  const absolute = new URL(path, root);
  const stat = await import("node:fs/promises").then(({ stat }) =>
    stat(absolute),
  );
  if (stat.isFile()) return [absolute];

  const files = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    files.push(
      ...(await collect(
        join(path, entry.name) + (entry.isDirectory() ? "/" : ""),
      )),
    );
  }
  return files;
}

const files = (
  await Promise.all(
    roots.map(async (path) => {
      try {
        return await collect(path);
      } catch {
        return [];
      }
    }),
  )
).flat();

const failures = [];
for (const file of files) {
  const extension = extname(file.pathname);
  if (extension && !textExtensions.has(extension)) continue;
  const content = await readFile(file, "utf8");
  for (const [label, value] of forbidden) {
    if (content.includes(value)) {
      failures.push(`${relative(new URL(".", root).pathname, file.pathname)}: ${label}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Content check passed across ${files.length} files.`);
}

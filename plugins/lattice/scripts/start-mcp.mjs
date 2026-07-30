import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredDependencies = [
  "@modelcontextprotocol/ext-apps",
  "@modelcontextprotocol/sdk",
  "zod",
];

function dependencyDirectory(packageName) {
  return path.join(rootDir, "node_modules", ...packageName.split("/"));
}

const missing = requiredDependencies.filter(
  (packageName) => !existsSync(dependencyDirectory(packageName)),
);
if (missing.length > 0) {
  throw new Error(
    `Lattice plugin dependencies are missing (${missing.join(", ")}). ` +
      "Install the plugin package before starting MCP: npm install --ignore-scripts.",
  );
}

process.chdir(rootDir);
await import(pathToFileURL(path.join(rootDir, "mcp", "server.mjs")).href);

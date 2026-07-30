import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export function pluginPath(...parts) {
  return path.join(PLUGIN_ROOT, ...parts);
}

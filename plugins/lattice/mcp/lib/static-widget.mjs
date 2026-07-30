import { readFile } from "node:fs/promises";

import { pluginPath } from "./plugin-root.mjs";

export async function latticeStaticHtml() {
  const [html, css, js] = await Promise.all([
    readFile(pluginPath("widget", "index.html"), "utf8"),
    readFile(pluginPath("widget", "widget.css"), "utf8"),
    readFile(pluginPath("widget", "widget.js"), "utf8"),
  ]);
  return html
    .replace("/* __LATTICE_WIDGET_CSS__ */", () => css)
    .replace("/* __LATTICE_WIDGET_JS__ */", () => js);
}

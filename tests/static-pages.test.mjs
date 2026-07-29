import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../dist/client/", import.meta.url);

test("exports an interactive GitHub Pages entrypoint under /lattice", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /Lattice/);
  assert.match(html, /完整图谱/);
  assert.match(html, /\/lattice\/assets\//);
  assert.doesNotMatch(html, /https:\/\/lattice-research\.sirius-ctrl/);
  await stat(new URL(".nojekyll", outputRoot));
});

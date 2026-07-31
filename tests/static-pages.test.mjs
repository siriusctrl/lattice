import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../dist/client/", import.meta.url);

test("exports an interactive GitHub Pages entrypoint under /lattice", async () => {
  const [html, chineseEssay, englishEssay] = await Promise.all([
    readFile(new URL("index.html", outputRoot), "utf8"),
    readFile(
      new URL("notes/beyond-linear-chat.html", outputRoot),
      "utf8",
    ),
    readFile(
      new URL("en/notes/beyond-linear-chat.html", outputRoot),
      "utf8",
    ),
  ]);

  assert.match(html, /Lattice/);
  assert.match(html, /研究图/);
  assert.match(html, /graph-node-total/);
  assert.doesNotMatch(html, /完整图谱/);
  assert.match(html, /\/lattice\/assets\//);
  assert.doesNotMatch(html, /https:\/\/lattice-research\.sirius-ctrl/);
  assert.match(chineseEssay, /对话会分叉，阅读仍应成篇/);
  assert.match(chineseEssay, /beyond-linear-chat\.png/);
  assert.match(chineseEssay, /href="\/lattice\/en\/notes\/beyond-linear-chat"/);
  assert.match(chineseEssay, /https:\/\/siriusctrl\.github\.io\/lattice\/notes\/beyond-linear-chat"/);
  assert.match(englishEssay, /A chat log is not a knowledge structure/);
  assert.match(englishEssay, /beyond-linear-chat\.png/);
  assert.match(englishEssay, /href="\/lattice\/notes\/beyond-linear-chat"/);
  assert.match(englishEssay, /https:\/\/siriusctrl\.github\.io\/lattice\/en\/notes\/beyond-linear-chat"/);
  await stat(new URL(".nojekyll", outputRoot));
  await stat(new URL("beyond-linear-chat.png", outputRoot));
});

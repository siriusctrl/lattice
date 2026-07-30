import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Lattice research workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Lattice - Explore naturally, leave with an article<\/title>/i,
  );
  assert.match(html, /介绍一下马斯克/);
  assert.match(html, /研究图/);
  assert.match(html, /Article/);
  assert.match(html, /Elon Musk/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});

test("keeps the static DemoHost entry, product metadata, and no starter preview", async () => {
  const [page, appShell, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LatticeApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /LatticeApp/);
  assert.match(appShell, /ResearchWorkspace/);
  assert.match(appShell, /createDemoHost/);
  assert.match(appShell, /__LATTICE_ACP_CONFIG__/);
  assert.match(layout, /Explore naturally, leave with an article/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /lattice-research-prototype/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", root)));
});

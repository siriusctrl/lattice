import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";

const baseURL = process.env.LATTICE_BASE_URL ?? "http://127.0.0.1:3000";
const outputRoot = new URL("../outputs/", import.meta.url);
const rawRoot = new URL("raw-video/", outputRoot);
const proofRoot = new URL("proof/", outputRoot);
const webmPath = new URL("lattice-demo.webm", outputRoot);

await rm(rawRoot, { recursive: true, force: true });
await rm(proofRoot, { recursive: true, force: true });
await mkdir(rawRoot, { recursive: true });
await mkdir(proofRoot, { recursive: true });
await rm(webmPath, { force: true });

async function waitForSite() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError ?? new Error(`Lattice is not reachable at ${baseURL}`);
}

let serverProcess = null;
try {
  const response = await fetch(baseURL);
  if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
} catch {
  serverProcess = spawn("npm", ["run", "dev"], {
    cwd: new URL("../", import.meta.url),
    detached: process.platform !== "win32",
    stdio: "ignore",
  });
}

await waitForSite();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: rawRoot.pathname,
    size: { width: 1440, height: 900 },
  },
});
const page = await context.newPage();
const video = page.video();

await page.addInitScript(() => {
  window.localStorage.setItem("lattice-theme", "light");
});
await page.goto(baseURL, { waitUntil: "networkidle" });
await page
  .locator("html[data-lattice-ready='true']")
  .waitFor({ state: "attached" });
await page.waitForTimeout(1_100);
await page.screenshot({ path: new URL("frame-01-root.png", proofRoot).pathname });

await page.locator('[data-anchor-target="spacex"]').click();
await page.getByTestId("research-card-spacex").waitFor();
await page.waitForTimeout(850);
await page.screenshot({
  path: new URL("frame-02-spacex.png", proofRoot).pathname,
});

await page
  .getByTestId("research-card-spacex")
  .locator('[data-anchor-target="crisis"]')
  .click();
await page.getByTestId("research-card-crisis").waitFor();
await page.waitForTimeout(800);
await page.screenshot({
  path: new URL("frame-03-crisis.png", proofRoot).pathname,
});

await page.getByRole("button", { name: "Article", exact: true }).click();
await page.getByTestId("article-section-crisis").waitFor();
await page.mouse.move(1400, 30);
await page.waitForTimeout(950);
await page.screenshot({
  path: new URL("frame-04-article-draft.png", proofRoot).pathname,
});

await page
  .getByTestId("article-sources")
  .locator('[data-source-node="spacex"]')
  .click();
await page.getByTestId("research-card-spacex").waitFor();
await page.waitForTimeout(650);
await page.getByRole("button", { name: "关闭当前分支" }).click();
await page.waitForTimeout(500);

await page
  .getByTestId("research-card-musk")
  .locator('[data-anchor-target="tesla"]')
  .click();
await page.getByTestId("research-card-tesla").waitFor();
await page.waitForTimeout(700);
await page
  .getByTestId("research-card-tesla")
  .locator('[data-anchor-target="crisis"]')
  .click();
await page.getByTestId("research-card-crisis").waitFor();
await page.waitForTimeout(800);
await page.screenshot({
  path: new URL("frame-05-converged-dag.png", proofRoot).pathname,
});

await page
  .getByTestId("graph-preview")
  .getByRole("button", { name: "展开研究图" })
  .click();
await page.waitForTimeout(700);
await page.getByTestId("theme-toggle").click();
await page.waitForTimeout(950);
await page.screenshot({
  path: new URL("frame-06-dark-graph.png", proofRoot).pathname,
});

await page
  .getByTestId("graph-preview")
  .getByRole("button", { name: "缩小研究图" })
  .click();
await page.getByRole("button", { name: "Article", exact: true }).click();
await page.getByTestId("article-section-crisis").waitFor();
await page.mouse.move(1400, 30);
await page.waitForTimeout(1_050);
await page.screenshot({
  path: new URL("frame-07-article-converged.png", proofRoot).pathname,
});

await page
  .locator(".article-outline")
  .getByRole("button", { name: "把退出所得投入工业系统" })
  .click();
await page.waitForTimeout(400);
await page
  .getByTestId("article-sources")
  .locator('[data-source-node="tesla"]')
  .click();
await page.getByTestId("research-card-tesla").waitFor();
await page.waitForTimeout(650);

const activeCard = page.locator('[data-active="true"]');
const composer = activeCard.getByPlaceholder("继续问...");
await composer.fill("这更像莽撞，还是一种可复制的风险方法？");
await activeCard.getByRole("button", { name: "发送追问" }).click();
await page.getByTestId("followup-thread-tesla").waitFor();
await page.getByTestId("followup-thread-tesla").scrollIntoViewIfNeeded();
await page.waitForTimeout(1_500);
await page.screenshot({
  path: new URL("frame-08-followup.png", proofRoot).pathname,
});
await page.waitForTimeout(1_000);

await activeCard.locator(".research-copy > p").nth(2).evaluate((paragraph) => {
  paragraph.scrollIntoView({ block: "center" });
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  paragraph.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
  );
});
await page.waitForTimeout(650);
await page.screenshot({
  path: new URL("frame-09-selection.png", proofRoot).pathname,
});
await page.getByRole("button", { name: "从选区分叉" }).click();
await page.waitForTimeout(800);

await page.getByRole("button", { name: "Article", exact: true }).click();
await page.getByTestId("article-section-research-notes").waitFor();
await page.mouse.move(1400, 30);
await page.waitForTimeout(1_200);
await page.screenshot({
  path: new URL("frame-10-final-article.png", proofRoot).pathname,
});

await page.close();
if (!video) throw new Error("Playwright video capture was unavailable");
await video.saveAs(webmPath.pathname);
await context.close();
await browser.close();

if (serverProcess?.pid) {
  if (process.platform === "win32") {
    serverProcess.kill();
  } else {
    process.kill(-serverProcess.pid, "SIGTERM");
  }
}

console.log(`Recorded ${webmPath.pathname}`);

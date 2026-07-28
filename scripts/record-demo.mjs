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

await page.locator('[data-anchor-target="spacex"]').hover();
await page.waitForTimeout(450);
await page.locator('[data-anchor-target="spacex"]').click();
await page.getByTestId("research-card-spacex").waitFor();
await page.waitForTimeout(850);
await page.screenshot({
  path: new URL("frame-02-spacex.png", proofRoot).pathname,
});

await page.locator('[data-anchor-target="crisis"]').hover();
await page.waitForTimeout(350);
await page.locator('[data-anchor-target="crisis"]').click();
await page.getByTestId("research-card-crisis").waitFor();
await page.waitForTimeout(800);
await page.screenshot({
  path: new URL("frame-03-crisis.png", proofRoot).pathname,
});

await page
  .getByTestId("graph-preview")
  .getByRole("button", { name: "展开研究图" })
  .click();
await page.waitForTimeout(700);
await page.getByTestId("theme-toggle").click();
await page.waitForTimeout(950);
await page.screenshot({
  path: new URL("frame-04-dark-graph.png", proofRoot).pathname,
});

await page
  .getByTestId("graph-preview")
  .getByRole("button", { name: "缩小研究图" })
  .click();
await page.waitForTimeout(450);
await page.getByRole("button", { name: "Elon Musk" }).first().click();
await page.waitForTimeout(600);

await page.locator('[data-anchor-target="tesla"]').hover();
await page.waitForTimeout(300);
await page.locator('[data-anchor-target="tesla"]').click();
await page.getByTestId("research-card-tesla").waitFor();
await page.waitForTimeout(700);
await page.locator('[data-anchor-target="crisis"]').click();
await page.getByTestId("research-card-crisis").waitFor();
await page.waitForTimeout(800);
await page.screenshot({
  path: new URL("frame-05-converged-dag.png", proofRoot).pathname,
});

const activeCard = page.locator('[data-active="true"]');
const composer = activeCard.getByPlaceholder("沿这个分支继续问...");
await composer.fill("这更像莽撞，还是一种可复制的风险方法？");
await activeCard.getByRole("button", { name: "发送追问" }).click();
await page.waitForTimeout(1_300);

await activeCard.locator(".research-copy > p").nth(2).evaluate((paragraph) => {
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
  path: new URL("frame-06-selection.png", proofRoot).pathname,
});
await page.getByRole("button", { name: "从选区分叉" }).click();
await page.waitForTimeout(800);

await page
  .getByTestId("graph-preview")
  .getByRole("button", { name: "展开研究图" })
  .click();
await page.waitForTimeout(1_300);
await page.screenshot({
  path: new URL("frame-07-final-graph.png", proofRoot).pathname,
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

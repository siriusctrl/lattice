import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";

const baseURL =
  process.env.LATTICE_BASE_URL ?? "http://127.0.0.1:3000";
const outputRoot = new URL("../outputs/", import.meta.url);
const rawRoot = new URL("raw-mobile-video/", outputRoot);
const proofRoot = new URL("mobile-proof/", outputRoot);
const webmPath = new URL("lattice-mobile-demo.webm", outputRoot);

await rm(rawRoot, { recursive: true, force: true });
await rm(proofRoot, { recursive: true, force: true });
await mkdir(rawRoot, { recursive: true });
await mkdir(proofRoot, { recursive: true });
await rm(webmPath, { force: true });

async function waitForSite() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  recordVideo: {
    dir: rawRoot.pathname,
    size: { width: 390, height: 844 },
  },
});
const page = await context.newPage();
const video = page.video();
const session = await context.newCDPSession(page);

await session.send("Emulation.setTouchEmulationEnabled", {
  enabled: true,
  maxTouchPoints: 1,
});

const touchPoint = (x, y) => ({
  x: Math.round(x),
  y: Math.round(y),
  radiusX: 5,
  radiusY: 5,
  force: 1,
  id: 1,
});

async function swipe(points) {
  const [first, ...rest] = points;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(first.x, first.y)],
  });
  for (const point of rest) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [touchPoint(point.x, point.y)],
    });
    await page.waitForTimeout(70);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

async function capture(name) {
  await page.screenshot({
    path: new URL(`${name}.png`, proofRoot).pathname,
  });
}

await page.addInitScript(() => {
  window.localStorage.setItem("lattice-theme", "light");
});
await page.goto(baseURL, { waitUntil: "networkidle" });
await page
  .locator("html[data-lattice-ready='true']")
  .waitFor({ state: "attached" });
await page.waitForTimeout(850);
await capture("frame-01-reading");

await page.locator('[data-anchor-target="origin"]').click();
await page
  .getByTestId("research-card-origin")
  .locator('[data-anchor-target="migration"]')
  .click();
await page
  .getByTestId("research-card-migration")
  .locator('[data-anchor-target="education"]')
  .click();
await page
  .getByTestId("research-card-education")
  .locator('[data-anchor-target="zip2"]')
  .click();
await page
  .getByTestId("graph-preview")
  .locator('[data-node-id="migration"]')
  .click({ force: true });
await page.waitForTimeout(850);
await capture("frame-02-middle-reading");

const readingSurface = page
  .getByTestId("research-card-migration")
  .locator(".card-scroll");
const readingBounds = await readingSurface.boundingBox();
if (!readingBounds) throw new Error("Missing reading surface bounds");
await swipe([
  {
    x: readingBounds.x + readingBounds.width * 0.54,
    y: readingBounds.y + readingBounds.height * 0.72,
  },
  {
    x: readingBounds.x + readingBounds.width * 0.54,
    y: readingBounds.y + readingBounds.height * 0.57,
  },
  {
    x: readingBounds.x + readingBounds.width * 0.55,
    y: readingBounds.y + readingBounds.height * 0.39,
  },
]);
await page.waitForTimeout(650);

await page
  .getByRole("button", { name: "从左侧查看 Card 路径" })
  .tap();
await page.waitForTimeout(650);
await capture("frame-03-folded-preview");

const deckBounds = await page
  .getByTestId("research-deck")
  .boundingBox();
if (!deckBounds) throw new Error("Missing Deck bounds");
const swipeX = deckBounds.x + deckBounds.width * 0.5;
const swipeY = deckBounds.y + deckBounds.height * 0.5;
await swipe([
  { x: swipeX, y: swipeY },
  { x: swipeX - 36, y: swipeY + 8 },
  { x: swipeX - 82, y: swipeY + 17 },
  { x: swipeX - 126, y: swipeY + 24 },
]);
await page.waitForTimeout(650);
await capture("frame-04-next-preview");

await swipe([
  { x: swipeX, y: swipeY },
  { x: swipeX + 34, y: swipeY + 6 },
  { x: swipeX + 78, y: swipeY + 14 },
  { x: swipeX + 122, y: swipeY + 21 },
]);
await page.waitForTimeout(500);
await page
  .locator('.deck-card-picker[data-deck-index="2"]')
  .tap();
await page.waitForTimeout(750);
await capture("frame-05-reading-restored");

await session.detach();
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

import { expect, Page, test } from "@playwright/test";

type FanSide = "left" | "right";

type FanSample = {
  angle: number;
  pivotX: number;
  pivotY: number;
};

async function openDeepDeck(page: Page) {
  await page.goto("/");
  await page
    .locator("html[data-lattice-ready='true']")
    .waitFor({ state: "attached" });
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
  await page.waitForTimeout(700);
}

async function startFanSampling(
  page: Page,
  deckIndex: number,
  side: FanSide,
) {
  await page.evaluate(
    ({ deckIndex: sampledIndex, side: sampledSide }) => {
      const scope = window as typeof window & {
        __latticeFanSamples?: FanSample[];
        __latticeFanMarker?: HTMLElement;
        __latticeFanFrame?: number;
      };
      if (scope.__latticeFanFrame) {
        window.cancelAnimationFrame(scope.__latticeFanFrame);
      }
      scope.__latticeFanMarker?.remove();

      const card = document.querySelector<HTMLElement>(
        `.research-card[data-deck-index="${sampledIndex}"]`,
      );
      if (!card) throw new Error("Missing sampled research Card");
      const fanLayer =
        sampledSide === "left"
          ? card.parentElement?.parentElement
          : card.parentElement;
      if (!fanLayer) throw new Error("Missing sampled fan layer");

      const marker = document.createElement("span");
      marker.style.position = "absolute";
      marker.style.bottom = "0";
      marker.style[sampledSide] = "0";
      marker.style.width = "0";
      marker.style.height = "0";
      marker.style.pointerEvents = "none";
      fanLayer.appendChild(marker);
      scope.__latticeFanMarker = marker;
      scope.__latticeFanSamples = [];

      const sample = () => {
        const matrix = new DOMMatrixReadOnly(
          window.getComputedStyle(fanLayer).transform,
        );
        const pivot = marker.getBoundingClientRect();
        scope.__latticeFanSamples?.push({
          angle: Math.atan2(matrix.b, matrix.a) * (180 / Math.PI),
          pivotX: pivot.left,
          pivotY: pivot.top,
        });
        scope.__latticeFanFrame = window.requestAnimationFrame(sample);
      };
      sample();
    },
    { deckIndex, side },
  );
}

async function takeFanSamples(page: Page) {
  return page.evaluate(() => {
    const scope = window as typeof window & {
      __latticeFanSamples?: FanSample[];
      __latticeFanMarker?: HTMLElement;
      __latticeFanFrame?: number;
    };
    if (scope.__latticeFanFrame) {
      window.cancelAnimationFrame(scope.__latticeFanFrame);
    }
    scope.__latticeFanMarker?.remove();
    const samples = scope.__latticeFanSamples ?? [];
    delete scope.__latticeFanFrame;
    delete scope.__latticeFanMarker;
    delete scope.__latticeFanSamples;
    return samples;
  });
}

function expectMonotonic(
  samples: FanSample[],
  direction: "increasing" | "decreasing",
) {
  expect(samples.length).toBeGreaterThanOrEqual(8);
  const meaningful = samples.filter(
    (sample, index) =>
      index === 0 ||
      Math.abs(sample.angle - samples[index - 1].angle) > 0.002,
  );
  for (let index = 1; index < meaningful.length; index += 1) {
    const delta = meaningful[index].angle - meaningful[index - 1].angle;
    if (direction === "increasing") {
      expect(delta).toBeGreaterThanOrEqual(-0.08);
    } else {
      expect(delta).toBeLessThanOrEqual(0.08);
    }
  }
}

function expectStationaryPivot(samples: FanSample[]) {
  const xValues = samples.map((sample) => sample.pivotX);
  const yValues = samples.map((sample) => sample.pivotY);
  expect(Math.max(...xValues) - Math.min(...xValues)).toBeLessThan(1);
  expect(Math.max(...yValues) - Math.min(...yValues)).toBeLessThan(1);
}

test("fans and retracts around fixed same-side lower corners", async ({
  page,
}) => {
  await openDeepDeck(page);
  const leftTrigger = page.getByRole("button", {
    name: "从左侧展开 Card 路径",
  });

  await startFanSampling(page, 0, "left");
  await leftTrigger.hover();
  await page.waitForTimeout(620);
  const opening = await takeFanSamples(page);
  expectMonotonic(opening, "decreasing");
  expectStationaryPivot(opening);
  expect(opening.at(-1)?.angle ?? 0).toBeLessThan(-6.7);

  await startFanSampling(page, 0, "left");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(620);
  const retracting = await takeFanSamples(page);
  expectMonotonic(retracting, "increasing");
  expectStationaryPivot(retracting);
  const dormantAngle = retracting.at(-1)?.angle ?? -10;
  expect(dormantAngle).toBeGreaterThan(-1.9);
  expect(dormantAngle).toBeLessThan(-1.5);

  await leftTrigger.hover();
  await leftTrigger.click();
  await page.mouse.move(720, 82);
  await page.waitForTimeout(700);
  await page
    .getByRole("button", { name: "打开 Card：比勒陀利亚" })
    .click({ position: { x: 16, y: 220 } });
  await page.waitForTimeout(620);
  const rightTrigger = page.getByRole("button", {
    name: "从右侧展开 Card 路径",
  });
  await startFanSampling(page, 4, "right");
  await rightTrigger.hover();
  await page.waitForTimeout(620);
  const rightOpening = await takeFanSamples(page);
  expectMonotonic(rightOpening, "increasing");
  expectStationaryPivot(rightOpening);
  expect(rightOpening.at(-1)?.angle ?? 0).toBeGreaterThan(5);
});

test("enters spread from a hinted fan without a one-frame teleport", async ({
  page,
}) => {
  await openDeepDeck(page);
  const trigger = page.getByRole("button", {
    name: "从左侧展开 Card 路径",
  });
  await trigger.hover();
  await page.waitForTimeout(620);

  await startFanSampling(page, 0, "left");
  await trigger.click();
  await page.waitForTimeout(900);
  const samples = await takeFanSamples(page);
  expectMonotonic(samples, "increasing");
  expect(samples.at(-1)?.angle ?? -10).toBeGreaterThan(-0.08);

  // A real transition must occupy several painted frames. Absolute frame
  // velocity is intentionally avoided because headless Chromium may skip rAFs.
  const movingFrames = samples.slice(1).filter((sample, index) => {
    const previous = samples[index];
    return (
      Math.hypot(
        sample.pivotX - previous.pivotX,
        sample.pivotY - previous.pivotY,
      ) > 0.5
    );
  });
  expect(movingFrames.length).toBeGreaterThanOrEqual(4);
});

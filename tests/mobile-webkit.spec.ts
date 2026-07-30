import { expect, test, type Page } from "@playwright/test";

type MotionSample = {
  preview: string;
  transition: string;
  outgoingLeft: number;
  outgoingRight: number;
  outgoingZ: number;
  incomingZ: number;
};

async function readMotionSample(
  page: Page,
  outgoingIndex: number,
  incomingIndex: number,
) {
  return page.evaluate(
    ({ outgoing, incoming }) => {
      const deck = document.querySelector<HTMLElement>(
        '[data-testid="research-deck"]',
      );
      const outgoingCard = document.querySelector<HTMLElement>(
        `.research-card[data-deck-index="${outgoing}"]`,
      );
      const incomingCard = document.querySelector<HTMLElement>(
        `.research-card[data-deck-index="${incoming}"]`,
      );
      const outgoingLayer = outgoingCard?.closest<HTMLElement>(
        ".research-card-motion",
      );
      const incomingLayer = incomingCard?.closest<HTMLElement>(
        ".research-card-motion",
      );
      if (!deck || !outgoingLayer || !incomingLayer) {
        throw new Error("Missing WebKit mobile motion surface");
      }

      const bounds = outgoingLayer.getBoundingClientRect();
      return {
        preview: deck.dataset.deckPreview ?? "missing",
        transition: deck.dataset.mobileTransition ?? "missing",
        outgoingLeft: bounds.left,
        outgoingRight: bounds.right,
        outgoingZ: Number(getComputedStyle(outgoingLayer).zIndex),
        incomingZ: Number(getComputedStyle(incomingLayer).zIndex),
      } satisfies MotionSample;
    },
    { outgoing: outgoingIndex, incoming: incomingIndex },
  );
}

test("keeps the right-swipe handoff monotonic in mobile WebKit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("lattice-theme", "light");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-lattice-ready",
    "true",
  );

  await page.locator('[data-anchor-target="origin"]').click();
  await page
    .getByTestId("research-card-origin")
    .locator('[data-anchor-target="migration"]')
    .click();
  await expect(page.getByTestId("research-card-migration")).toHaveAttribute(
    "data-active",
    "true",
  );

  await page
    .getByRole("button", { name: "从左侧查看 Card 路径" })
    .click();
  const deck = page.getByTestId("research-deck");
  await expect(deck).toHaveAttribute("data-deck-preview", "2");
  const bounds = await deck.boundingBox();
  if (!bounds) throw new Error("Missing WebKit Deck bounds");

  const samples: MotionSample[] = [];
  await page.mouse.move(
    bounds.x + bounds.width * 0.48,
    bounds.y + bounds.height * 0.54,
  );
  await page.mouse.down();
  for (const progress of [18, 38, 62, 86, 104, 118]) {
    await page.mouse.move(
      bounds.x + bounds.width * 0.48 + progress,
      bounds.y + bounds.height * 0.54 + progress * 0.15,
    );
    await page.waitForTimeout(18);
    samples.push(await readMotionSample(page, 2, 1));
  }
  await page.mouse.up();

  await expect(deck).toHaveAttribute("data-mobile-transition", "2:1");
  await expect(deck).toHaveAttribute("data-deck-preview", "2");
  let transitionSampleCount = 0;
  for (let index = 0; index < 8; index += 1) {
    const sample = await readMotionSample(page, 2, 1);
    samples.push(sample);
    if (sample.transition === "idle") break;
    expect(sample.transition).toBe("2:1");
    expect(sample.outgoingZ).toBeGreaterThan(sample.incomingZ);
    transitionSampleCount += 1;
    await page.waitForTimeout(28);
  }
  expect(transitionSampleCount).toBeGreaterThan(1);
  await expect(deck).toHaveAttribute("data-deck-preview", "1");
  await expect(deck).toHaveAttribute("data-mobile-transition", "idle");
  await page.waitForTimeout(80);
  samples.push(await readMotionSample(page, 2, 1));

  const outgoingLefts = samples.map((sample) => sample.outgoingLeft);
  for (let index = 1; index < outgoingLefts.length; index += 1) {
    expect(outgoingLefts[index] - outgoingLefts[index - 1]).toBeGreaterThanOrEqual(
      -1.5,
    );
  }
  expect(
    Math.max(...outgoingLefts) - outgoingLefts.at(-1)!,
  ).toBeLessThan(3);
  expect(Math.max(...outgoingLefts)).toBeLessThan(372);
});

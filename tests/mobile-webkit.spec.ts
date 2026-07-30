import { expect, test, type Page } from "@playwright/test";

type MotionSample = {
  preview: string;
  transition: string;
  cards: Record<
    string,
    {
      left: number;
      opacity: number;
      right: number;
      zIndex: number;
    }
  >;
};

async function readMotionSample(
  page: Page,
  indices: number[],
) {
  return page.evaluate(
    (cardIndices) => {
      const deck = document.querySelector<HTMLElement>(
        '[data-testid="research-deck"]',
      );
      if (!deck) {
        throw new Error("Missing WebKit mobile motion surface");
      }

      return {
        preview: deck.dataset.deckPreview ?? "missing",
        transition: deck.dataset.mobileTransition ?? "missing",
        cards: Object.fromEntries(
          cardIndices.map((index) => {
            const card = document.querySelector<HTMLElement>(
              `.research-card[data-deck-index="${index}"]`,
            );
            const layer = card?.closest<HTMLElement>(
              ".research-card-motion",
            );
            if (!layer) {
              throw new Error(`Missing WebKit mobile Card ${index}`);
            }
            const bounds = layer.getBoundingClientRect();
            return [
              String(index),
              {
                left: bounds.left,
                opacity: Number(getComputedStyle(layer).opacity),
                right: bounds.right,
                zIndex: Number(getComputedStyle(layer).zIndex),
              },
            ];
          }),
        ),
      } satisfies MotionSample;
    },
    indices,
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
  await page
    .getByTestId("research-card-migration")
    .locator('[data-anchor-target="education"]')
    .click();
  await page
    .getByTestId("research-card-education")
    .locator('[data-anchor-target="zip2"]')
    .click();
  await page
    .getByTestId("research-card-zip2")
    .locator('[data-anchor-target="paypal"]')
    .click();
  await page
    .getByTestId("graph-preview")
    .locator('[data-node-id="origin"]')
    .click({ force: true });
  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );

  await page
    .getByRole("button", { name: "从左侧查看 Card 路径" })
    .click();
  const deck = page.getByTestId("research-deck");
  await expect(deck).toHaveAttribute("data-deck-preview", "1");
  const bounds = await deck.boundingBox();
  if (!bounds) throw new Error("Missing WebKit Deck bounds");

  const samples: MotionSample[] = [];
  const cardIndices = [0, 1, 2, 3, 4, 5];
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
    samples.push(await readMotionSample(page, cardIndices));
  }
  await page.mouse.up();

  await expect(deck).toHaveAttribute("data-mobile-transition", "1:0");
  await expect(deck).toHaveAttribute("data-deck-preview", "1");
  let transitionSampleCount = 0;
  for (let index = 0; index < 8; index += 1) {
    const sample = await readMotionSample(page, cardIndices);
    samples.push(sample);
    if (sample.transition === "idle") break;
    expect(sample.transition).toBe("1:0");
    expect(sample.cards["1"].zIndex).toBeGreaterThan(
      sample.cards["0"].zIndex,
    );
    transitionSampleCount += 1;
    await page.waitForTimeout(28);
  }
  expect(transitionSampleCount).toBeGreaterThan(1);
  await expect(deck).toHaveAttribute("data-deck-preview", "0");
  await expect(deck).toHaveAttribute("data-mobile-transition", "idle");
  await page.waitForTimeout(80);
  samples.push(await readMotionSample(page, cardIndices));

  for (const cardIndex of cardIndices) {
    const cardCenters = samples.map(
      (sample) =>
        (sample.cards[String(cardIndex)].left +
          sample.cards[String(cardIndex)].right) /
        2,
    );
    for (let index = 1; index < cardCenters.length; index += 1) {
      expect(
        cardCenters[index] - cardCenters[index - 1],
      ).toBeGreaterThanOrEqual(-1.5);
    }
  }
  const outgoingLefts = samples.map(
    (sample) => sample.cards["1"].left,
  );
  expect(
    Math.max(...outgoingLefts) - outgoingLefts.at(-1)!,
  ).toBeLessThan(3);
  expect(Math.max(...outgoingLefts)).toBeLessThan(372);

  const lastTransitionIndex = samples.findLastIndex(
    (sample) => sample.transition === "1:0",
  );
  const firstSettled = samples
    .slice(lastTransitionIndex + 1)
    .find(
      (sample) =>
        sample.transition === "idle" && sample.preview === "0",
    );
  expect(lastTransitionIndex).toBeGreaterThanOrEqual(0);
  expect(firstSettled).toBeDefined();
  for (const cardIndex of cardIndices) {
    expect(
      Math.abs(
        samples[lastTransitionIndex].cards[String(cardIndex)].left -
          firstSettled!.cards[String(cardIndex)].left,
      ),
    ).toBeLessThan(2);
    expect(
      Math.abs(
        samples[lastTransitionIndex].cards[String(cardIndex)].opacity -
          firstSettled!.cards[String(cardIndex)].opacity,
      ),
    ).toBeLessThan(0.02);
  }
  const hiddenPileEdgeOpacities = samples.map(
    (sample) => sample.cards["5"].opacity,
  );
  for (let index = 1; index < hiddenPileEdgeOpacities.length; index += 1) {
    expect(
      hiddenPileEdgeOpacities[index] -
        hiddenPileEdgeOpacities[index - 1],
    ).toBeLessThanOrEqual(0.02);
  }
});

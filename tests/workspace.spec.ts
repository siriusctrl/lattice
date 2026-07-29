import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

type TouchCoordinate = {
  x: number;
  y: number;
};

async function dispatchTouchGesture(
  page: Page,
  points: TouchCoordinate[],
  completion: "end" | "cancel" = "end",
) {
  if (points.length === 0) {
    throw new Error("A touch gesture needs at least one coordinate");
  }

  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const touchPoint = ({ x, y }: TouchCoordinate) => ({
    x: Math.round(x),
    y: Math.round(y),
    radiusX: 5,
    radiusY: 5,
    force: 1,
    id: 1,
  });

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(points[0])],
  });
  for (const point of points.slice(1)) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [touchPoint(point)],
    });
    await page.waitForTimeout(18);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: completion === "cancel" ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function touchCenter(page: Page, target: Locator) {
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error("Missing touch target bounds");
  await dispatchTouchGesture(page, [
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
  ]);
}

async function readCollapsedFanPivots(
  page: Page,
  side: "left" | "right",
) {
  return page.locator(".research-card").evaluateAll((cards, fanSide) => {
    return cards
      .filter((card) => {
        const attribute =
          fanSide === "left"
            ? "data-left-fan-rotate"
            : "data-right-fan-rotate";
        return Math.abs(Number(card.getAttribute(attribute))) > 0;
      })
      .map((card) => {
        const fanLayer =
          fanSide === "left"
            ? card.parentElement?.parentElement
            : card.parentElement;
        if (!fanLayer) throw new Error("Missing Card fan layer");

        const marker = document.createElement("span");
        marker.style.position = "absolute";
        marker.style.bottom = "0";
        marker.style[fanSide] = "0";
        marker.style.width = "0";
        marker.style.height = "0";
        fanLayer.appendChild(marker);
        const bounds = marker.getBoundingClientRect();
        marker.remove();
        return { x: bounds.left, y: bounds.top };
      });
  }, side);
}

function expectSharedFanPivot(pivots: { x: number; y: number }[]) {
  expect(pivots.length).toBeGreaterThan(1);
  const xValues = pivots.map((pivot) => pivot.x);
  const yValues = pivots.map((pivot) => pivot.y);
  expect(Math.max(...xValues) - Math.min(...xValues)).toBeLessThan(1);
  expect(Math.max(...yValues) - Math.min(...yValues)).toBeLessThan(1);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("lattice-theme", "light");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-lattice-ready",
    "true",
  );
  await expect(page.getByTestId("research-card-musk")).toBeVisible();
});

test("opens completed cards, closes the active branch, and preserves the full graph", async ({
  page,
}) => {
  await expect(page.getByText("读法", { exact: true })).toHaveCount(0);
  await expect(page.getByText("暂时结论", { exact: true })).toHaveCount(0);
  const rootCard = page.getByTestId("research-card-musk");
  await expect(rootCard.locator("img")).toHaveCount(0);
  await expect(rootCard.locator(".card-header")).toHaveCount(0);
  await expect(rootCard.locator(".card-title-group")).toHaveCount(0);
  await expect(rootCard.getByText("查看成稿", { exact: true })).toHaveCount(0);
  await expect(page.locator(".workspace-topic")).toHaveCount(0);
  await expect(page.locator(".selection-hint")).toHaveCount(0);
  await expect(page.getByText("当前位置", { exact: true })).toHaveCount(0);
  await expect(
    page.getByTestId("graph-preview").locator(".graph-focus-bar"),
  ).toContainText("Elon Musk");
  await expect(
    page
      .getByTestId("graph-preview")
      .locator(".graph-focus-bar .graph-node-total"),
  ).toHaveText("21 个节点");
  await expect(
    page
      .getByTestId("graph-preview")
      .locator(".graph-preview-header"),
  ).not.toContainText("完整图谱");
  await expect(
    page.getByTestId("graph-preview").locator(".graph-count"),
  ).toHaveCount(0);
  await expect(page.locator(".graph-active-label")).toHaveCount(0);
  await expect(
    page.getByTestId("graph-preview").locator(".graph-node-potential"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("graph-preview").locator(".graph-node-discovered"),
  ).toHaveCount(21);
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-discovered"),
  ).toHaveCount(25);
  await expect(page.getByTestId("graph-preview")).toHaveAttribute(
    "data-semantic-edge-count",
    "46",
  );
  await expect(page.getByTestId("graph-preview")).toHaveAttribute(
    "data-primary-edge-count",
    "25",
  );
  await expect(page.getByTestId("graph-preview")).toContainText("21 个节点");
  await expect(page.locator(".anchor-tooltip")).toHaveCount(0);
  await expect(page.locator(".forking-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "关闭当前分支" }),
  ).toHaveCount(0);
  const underlineOffset = await rootCard
    .locator('[data-anchor-target="origin"] > span')
    .first()
    .evaluate((label) => getComputedStyle(label).textUnderlineOffset);
  expect(underlineOffset).toBe("1px");
  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(
    page.getByTestId("graph-preview").locator(".graph-focus-bar"),
  ).toContainText("SpaceX");
  const compactGraphRegions = await page
    .getByTestId("graph-preview")
    .evaluate((graph) => {
      const canvas = graph.querySelector(".graph-canvas");
      const focusBar = graph.querySelector(".graph-focus-bar");
      if (!canvas || !focusBar) throw new Error("Missing compact graph regions");
      const canvasRect = canvas.getBoundingClientRect();
      const barRect = focusBar.getBoundingClientRect();
      return {
        canvasBottom: canvasRect.bottom,
        barTop: barRect.top,
      };
    });
  expect(compactGraphRegions.barTop).toBeGreaterThanOrEqual(
    compactGraphRegions.canvasBottom - 0.5,
  );
  await expect(page.getByTestId("graph-preview")).toContainText("21 个节点");
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-primary"),
  ).toHaveCount(25);
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-context"),
  ).toHaveCount(1);
  const edgeGeometry = await page
    .getByTestId("graph-preview")
    .locator(".graph-edge-discovered")
    .first()
    .evaluate((path) => {
      const svgPath = path as SVGPathElement;
      const svg = svgPath.ownerSVGElement;
      const fromId = svgPath.getAttribute("data-edge-from");
      const toId = svgPath.getAttribute("data-edge-to");
      if (!svg || !fromId || !toId) throw new Error("Incomplete graph edge");

      const from = svg.querySelector<SVGCircleElement>(
        `[data-node-id="${fromId}"] circle`,
      );
      const to = svg.querySelector<SVGCircleElement>(
        `[data-node-id="${toId}"] circle`,
      );
      if (!from || !to) throw new Error("Missing graph endpoint");

      const pathMatrix = svgPath.getScreenCTM();
      const fromMatrix = from.getScreenCTM();
      const toMatrix = to.getScreenCTM();
      if (!pathMatrix || !fromMatrix || !toMatrix) {
        throw new Error("Missing graph transform");
      }

      const pathLength = svgPath.getTotalLength();
      const start = svgPath.getPointAtLength(0);
      const end = svgPath.getPointAtLength(pathLength);
      const pathStart = new DOMPoint(start.x, start.y).matrixTransform(
        pathMatrix,
      );
      const pathEnd = new DOMPoint(end.x, end.y).matrixTransform(pathMatrix);
      const fromCenter = new DOMPoint(0, 0).matrixTransform(fromMatrix);
      const toCenter = new DOMPoint(0, 0).matrixTransform(toMatrix);

      return {
        startDistance: Math.hypot(
          pathStart.x - fromCenter.x,
          pathStart.y - fromCenter.y,
        ),
        endDistance: Math.hypot(
          pathEnd.x - toCenter.x,
          pathEnd.y - toCenter.y,
        ),
        dashArray: getComputedStyle(svgPath).strokeDasharray,
        pathLength: svgPath.getAttribute("pathLength"),
      };
    });
  expect(edgeGeometry.startDistance).toBeLessThan(0.1);
  expect(edgeGeometry.endDistance).toBeLessThan(0.1);
  expect(edgeGeometry.dashArray).toBe("none");
  expect(edgeGeometry.pathLength).toBeNull();

  await page.getByRole("button", { name: "关闭当前分支" }).click();
  await expect(page.getByTestId("research-card-musk")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.getByTestId("research-deck")).toHaveAttribute(
    "data-deck-size",
    "1",
  );
  await expect(page.getByTestId("research-card-spacex")).toHaveCount(0);
  await expect(page.getByTestId("graph-preview")).toContainText("21 个节点");
  await expect(
    page
      .getByTestId("graph-preview")
      .locator('[data-node-id="spacex"]'),
  ).toBeVisible();

  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("spreads a deep deck and returns to an earlier card without deleting history", async ({
  page,
}) => {
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

  const deck = page.getByTestId("research-deck");
  await expect(deck).toHaveAttribute("data-deck-size", "5");
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(page.locator(".deck-spread-handle")).toHaveCount(0);
  await expect(page.getByTestId("research-card-musk")).toHaveAttribute(
    "inert",
    "",
  );
  await expect(page.getByTestId("research-card-zip2")).not.toHaveAttribute(
    "inert",
  );
  const hiddenCardAcceptedFocus = await page
    .getByTestId("research-card-musk")
    .locator("button")
    .first()
    .evaluate((button) => {
      (button as HTMLButtonElement).focus();
      return document.activeElement === button;
    });
  expect(hiddenCardAcceptedFocus).toBe(false);

  const readDeckGeometry = () =>
    page.locator(".research-card").evaluateAll((cards) => {
      const geometry = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          center: rect.left + rect.width / 2,
          left: rect.left,
        };
      });
      const centers = geometry.map((card) => card.center);
      return {
        ordered: centers.every(
          (center, index) => index === 0 || center > centers[index - 1],
        ),
        span: Math.max(...centers) - Math.min(...centers),
        geometry,
      };
    });

  const edgeTrigger = page.getByRole("button", {
    name: "从左侧展开 Card 路径",
  });
  await edgeTrigger.hover();
  await expect(deck).toHaveClass(/deck-wrap-hinted/);
  await expect(deck).toHaveAttribute("data-deck-hint", "left");
  await expect
    .poll(async () => {
      const cards = (await readDeckGeometry()).geometry;
      return cards.at(-1)!.left - cards[0].left;
    })
    .toBeGreaterThan(70);
  const leftFan = await readDeckGeometry();
  expect(leftFan.geometry[0].left).toBeLessThan(
    leftFan.geometry.at(-1)?.left ?? 0,
  );

  await edgeTrigger.click();
  await expect(deck).toHaveAttribute("data-deck-mode", "spread");
  await expect(page.getByTestId("deck-spread-caption")).toHaveCount(0);
  await expect(page.locator(".deck-card-picker")).toHaveCount(5);
  await expect(page.locator(".research-card[inert]")).toHaveCount(5);
  const spreadContentAcceptedFocus = await page
    .getByTestId("research-card-musk")
    .locator("button")
    .first()
    .evaluate((button) => {
      (button as HTMLButtonElement).focus();
      return document.activeElement === button;
    });
  expect(spreadContentAcceptedFocus).toBe(false);
  await expect.poll(async () => (await readDeckGeometry()).span).toBeGreaterThan(
    300,
  );
  const spreadGeometry = await readDeckGeometry();
  expect(spreadGeometry.ordered).toBe(true);

  const originPicker = page.getByRole("button", {
    name: "打开 Card：比勒陀利亚",
  });
  await originPicker.hover({ position: { x: 12, y: 220 } });
  await expect(page.getByTestId("deck-spread-caption")).toContainText(
    "比勒陀利亚",
  );
  await expect(deck).toHaveAttribute("data-deck-preview", "1");

  const previewCenters = await page
    .locator(".research-card")
    .evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left + rect.width / 2;
      }),
    );
  expect(previewCenters[0]).toBeLessThan(previewCenters[1]);
  expect(previewCenters.slice(2).every((center) => center > previewCenters[1]))
    .toBe(true);

  await originPicker.click();

  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(deck).toHaveAttribute("data-deck-size", "5");
  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.getByTestId("research-card-zip2")).toBeAttached();

  const rightTrigger = page.getByRole("button", {
    name: "从右侧展开 Card 路径",
  });
  await rightTrigger.hover();
  await expect(deck).toHaveAttribute("data-deck-hint", "right");
  await expect(page.getByTestId("research-card-zip2")).toHaveAttribute(
    "data-right-fan-rotate",
    "5.150",
  );
  await page.mouse.move(0, 0);
  await expect(deck).toHaveAttribute("data-deck-hint", "none");

  await page.getByRole("button", { name: "关闭当前分支" }).click();
  await expect(deck).toHaveAttribute("data-deck-size", "1");
  await expect(page.getByTestId("research-card-musk")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.getByTestId("research-card-origin")).toHaveCount(0);
  await expect(page.getByTestId("research-card-zip2")).toHaveCount(0);
  await expect(
    page
      .getByTestId("graph-preview")
      .locator('[data-node-id="zip2"]'),
  ).toBeVisible();

  await page.locator('[data-anchor-target="origin"]').click();
  await page
    .getByTestId("research-card-origin")
    .locator('[data-anchor-target="blastar"]')
    .click();
  await expect(page.getByTestId("research-card-blastar")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(deck).toHaveAttribute("data-deck-size", "3");
  await expect(
    page
      .getByTestId("graph-preview")
      .locator('[data-node-id="zip2"]'),
  ).toBeVisible();
});

test("keeps a deep desktop Stack legible when focusing the root and existing suffix", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
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

  const deck = page.getByTestId("research-deck");
  const cards = page.locator(".research-card");
  const rootCard = page.getByTestId("research-card-musk");
  const lastCard = page.getByTestId("research-card-zip2");
  const cardIds = ["musk", "origin", "migration", "education", "zip2"];

  const readStackSurface = async () =>
    cards.evaluateAll((elements) => {
      const geometry = elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          active: element.getAttribute("data-active") === "true",
          boxShadow: window.getComputedStyle(element).boxShadow,
          left: rect.left,
          right: rect.right,
        };
      });
      const active = geometry.find((card) => card.active);
      if (!active) throw new Error("Missing active Card");

      return {
        activeShadow: active.boxShadow,
        inactiveShadows: geometry
          .filter((card) => !card.active)
          .map((card) => card.boxShadow),
        leftExposure: active.left - Math.min(...geometry.map((card) => card.left)),
        rightExposure:
          Math.max(...geometry.map((card) => card.right)) - active.right,
      };
    });

  await expect(deck).toHaveAttribute("data-deck-size", "5");
  await expect(lastCard).toHaveAttribute("data-active", "true");
  await expect
    .poll(async () => (await readStackSurface()).leftExposure)
    .toBeGreaterThan(20);
  await expect
    .poll(async () =>
      (await readStackSurface()).inactiveShadows.every(
        (shadow) => shadow === "none",
      ),
    )
    .toBe(true);

  const lastSurface = await readStackSurface();
  expect(lastSurface.activeShadow).not.toBe("none");
  expect(lastSurface.inactiveShadows).toEqual(["none", "none", "none", "none"]);
  expectSharedFanPivot(await readCollapsedFanPivots(page, "left"));

  await page
    .getByTestId("graph-preview")
    .locator('[data-node-id="musk"]')
    .click();

  await expect(rootCard).toHaveAttribute("data-active", "true");
  await expect(deck).toHaveAttribute("data-deck-size", "5");
  await expect(cards).toHaveCount(5);
  for (const cardId of cardIds.slice(1)) {
    await expect(page.getByTestId(`research-card-${cardId}`)).toBeAttached();
  }
  await expect
    .poll(async () => (await readStackSurface()).rightExposure)
    .toBeGreaterThan(20);
  await expect
    .poll(async () =>
      (await readStackSurface()).inactiveShadows.every(
        (shadow) => shadow === "none",
      ),
    )
    .toBe(true);

  const rootSurface = await readStackSurface();
  expect(rootSurface.activeShadow).not.toBe("none");
  expect(rootSurface.inactiveShadows).toEqual(["none", "none", "none", "none"]);
  expectSharedFanPivot(await readCollapsedFanPivots(page, "right"));

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(async () =>
      (await readStackSurface()).inactiveShadows.every(
        (shadow) => shadow === "none",
      ),
    )
    .toBe(true);
  expect((await readStackSurface()).activeShadow).not.toBe("none");

  // An anchor that already exists to the right only changes focus. It must not
  // discard the remainder of the path.
  await rootCard.locator('[data-anchor-target="origin"]').click();
  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(deck).toHaveAttribute("data-deck-size", "5");
  await expect(cards).toHaveCount(5);
  for (const cardId of cardIds) {
    await expect(page.getByTestId(`research-card-${cardId}`)).toBeAttached();
  }

  await page
    .getByTestId("graph-preview")
    .locator('[data-node-id="musk"]')
    .click();
  await expect(rootCard).toHaveAttribute("data-active", "true");

  const rightTrigger = page.getByRole("button", {
    name: "从右侧展开 Card 路径",
  });
  await expect(rightTrigger).toBeVisible();
  await rightTrigger.hover();
  await expect(deck).toHaveAttribute("data-deck-hint", "right");
  await rightTrigger.click();

  await expect(deck).toHaveAttribute("data-deck-mode", "spread");
  await expect(page.locator(".deck-card-picker")).toHaveCount(5);
  await expect(deck).toHaveAttribute("data-deck-size", "5");
});

test("opens a folded mobile Deck before swiping and commits on tap", async ({
  page,
}) => {
  await page.locator('[data-anchor-target="origin"]').click();
  await page
    .getByTestId("research-card-origin")
    .locator('[data-anchor-target="migration"]')
    .click();
  await page
    .getByTestId("graph-preview")
    .locator('[data-node-id="musk"]')
    .click();
  await expect(page.getByTestId("research-card-musk")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });

  const deck = page.getByTestId("research-deck");
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(page.getByRole("button", {
    name: "从左侧展开 Card 路径",
  })).toHaveCount(0);

  const readingTouchAction = await deck.evaluate(
    (element) => window.getComputedStyle(element).touchAction,
  );
  expect(readingTouchAction).toBe("pan-y");

  const rootCard = page.getByTestId("research-card-musk");
  const readingSurface = rootCard.locator(".card-scroll");
  await readingSurface.evaluate((element) => {
    element.scrollTop = 0;
  });
  const readingBounds = await readingSurface.boundingBox();
  if (!readingBounds) throw new Error("Missing mobile reading bounds");
  expect(
    await readingSurface.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    ),
  ).toBeGreaterThan(80);

  // A real vertical touch is left to the native Card scroller in read mode.
  await dispatchTouchGesture(page, [
    {
      x: readingBounds.x + readingBounds.width * 0.52,
      y: readingBounds.y + readingBounds.height * 0.72,
    },
    {
      x: readingBounds.x + readingBounds.width * 0.53,
      y: readingBounds.y + readingBounds.height * 0.62,
    },
    {
      x: readingBounds.x + readingBounds.width * 0.54,
      y: readingBounds.y + readingBounds.height * 0.48,
    },
    {
      x: readingBounds.x + readingBounds.width * 0.55,
      y: readingBounds.y + readingBounds.height * 0.32,
    },
  ]);
  await expect
    .poll(() => readingSurface.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(40);
  await expect(rootCard).toHaveAttribute("data-active", "true");
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");

  const deckBounds = await deck.boundingBox();
  if (!deckBounds) throw new Error("Missing mobile deck bounds");
  const centerY = deckBounds.y + deckBounds.height * 0.54;

  const rightEdge = page.getByRole("button", {
    name: "从右侧查看 Card 路径",
  });
  await touchCenter(page, rightEdge);
  await expect(deck).toHaveAttribute("data-deck-mode", "preview");
  await expect(deck).toHaveAttribute("data-deck-preview", "0");
  await expect(rootCard).toHaveAttribute("data-active", "true");
  expect(
    await deck.evaluate(
      (element) => window.getComputedStyle(element).touchAction,
    ),
  ).toBe("none");

  // Preview owns the gesture, so modest vertical thumb drift still navigates.
  const swipeStartX = deckBounds.x + deckBounds.width * 0.48;
  await dispatchTouchGesture(page, [
    { x: swipeStartX, y: centerY },
    { x: swipeStartX - 28, y: centerY + 7 },
    { x: swipeStartX - 72, y: centerY + 16 },
    { x: swipeStartX - 118, y: centerY + 25 },
  ]);
  await expect(deck).toHaveAttribute("data-deck-preview", "1");
  await expect(deck).toHaveAttribute("data-deck-mode", "preview");
  await expect(rootCard).toHaveAttribute("data-active", "true");
  await expect(deck).not.toHaveClass(/deck-wrap-swiping/);

  // The touchend-generated click must not accidentally commit the swipe.
  await page.waitForTimeout(120);
  await expect(deck).toHaveAttribute("data-deck-mode", "preview");
  await expect(rootCard).toHaveAttribute("data-active", "true");

  await page.waitForTimeout(130);
  const cardCenters = await page.locator(".research-card").evaluateAll(
    (cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left + rect.width / 2;
      }),
  );
  expect(cardCenters[0]).toBeLessThan(cardCenters[1]);
  expect(cardCenters[2]).toBeGreaterThan(cardCenters[1]);

  // Tapping the centered preview is the only operation that commits focus.
  await touchCenter(
    page,
    page.locator('.deck-card-picker[data-deck-index="1"]'),
  );
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );

  // Re-enter preview, navigate to the first item, and resist its outer edge.
  await touchCenter(
    page,
    page.getByRole("button", {
      name: "从左侧查看 Card 路径",
    }),
  );
  await expect(deck).toHaveAttribute("data-deck-preview", "1");
  await dispatchTouchGesture(page, [
    { x: swipeStartX, y: centerY },
    { x: swipeStartX + 54, y: centerY + 8 },
    { x: swipeStartX + 112, y: centerY + 17 },
  ]);
  await expect(deck).toHaveAttribute("data-deck-preview", "0");

  await dispatchTouchGesture(page, [
    { x: swipeStartX, y: centerY },
    { x: swipeStartX + 62, y: centerY + 5 },
    { x: swipeStartX + 124, y: centerY + 12 },
  ]);
  await expect(deck).toHaveAttribute("data-deck-preview", "0");
  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );

  // Browser cancellation restores a settled preview without committing.
  await dispatchTouchGesture(
    page,
    [
      { x: swipeStartX, y: centerY },
      { x: swipeStartX - 38, y: centerY + 9 },
      { x: swipeStartX - 82, y: centerY + 19 },
    ],
    "cancel",
  );
  await expect(deck).toHaveAttribute("data-deck-preview", "0");
  await expect(deck).toHaveAttribute("data-deck-mode", "preview");
  await expect(deck).not.toHaveClass(/deck-wrap-swiping/);
  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );

  // A hybrid-device mouse click also opens the centered Card.
  await page
    .locator('.deck-card-picker[data-deck-index="0"]')
    .click();
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(rootCard).toHaveAttribute("data-active", "true");

  // Keyboard cancel and view changes both leave folded browsing cleanly.
  await touchCenter(
    page,
    page.getByRole("button", {
      name: "从右侧查看 Card 路径",
    }),
  );
  await expect(deck).toHaveAttribute("data-deck-mode", "preview");
  await page.keyboard.press("Escape");
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(rootCard).toHaveAttribute("data-active", "true");

  await touchCenter(
    page,
    page.getByRole("button", {
      name: "从右侧查看 Card 路径",
    }),
  );
  await page.getByRole("button", { name: "Article" }).click();
  await expect(page.getByRole("button", { name: "Explore" })).toBeVisible();
  await page.getByRole("button", { name: "Explore" }).click();
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(rootCard).toHaveAttribute("data-active", "true");

  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ""))
    .toBe("");
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBeLessThanOrEqual(390);
});

test("keeps the completed graph fixed while active focus moves smoothly", async ({
  page,
}) => {
  const graph = page.getByTestId("graph-preview");
  const positionsBefore = await graph.locator(".graph-node").evaluateAll(
    (groups) =>
      Object.fromEntries(
        groups.map((group) => [
          group.getAttribute("data-node-id"),
          group.getAttribute("transform"),
        ]),
      ),
  );
  const orbitBefore = await graph.locator(".graph-active-orbit").evaluate(
    (circle) => ({
      cx: circle.getAttribute("cx"),
      cy: circle.getAttribute("cy"),
    }),
  );

  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(graph.locator(".graph-node-active")).toHaveAttribute(
    "data-node-id",
    "spacex",
  );
  await page.waitForTimeout(700);

  const positionsAfter = await graph.locator(".graph-node").evaluateAll(
    (groups) =>
      Object.fromEntries(
        groups.map((group) => [
          group.getAttribute("data-node-id"),
          group.getAttribute("transform"),
        ]),
      ),
  );
  const orbitAfter = await graph.locator(".graph-active-orbit").evaluate(
    (circle) => ({
      cx: circle.getAttribute("cx"),
      cy: circle.getAttribute("cy"),
    }),
  );
  expect(positionsAfter).toEqual(positionsBefore);
  expect(orbitAfter).not.toEqual(orbitBefore);

  await page.getByRole("button", { name: "展开研究图" }).click();
  await expect(graph).toHaveClass(/graph-preview-expanded/);
  await expect(
    graph.locator(".graph-focus-bar .graph-node-total"),
  ).toHaveText("21 个节点");
  await expect(graph.locator(".graph-focus-bar")).toContainText("SpaceX");
  await page.waitForTimeout(700);

  const layoutMetrics = await graph
    .locator(".graph-node-discovered")
    .evaluateAll((groups) => {
      const centers = groups.map((group) => {
        const matrix = (group as SVGGElement).getScreenCTM();
        if (!matrix) throw new Error("Missing graph node transform");
        const center = new DOMPoint(0, 0).matrixTransform(matrix);
        return { x: center.x, y: center.y };
      });
      let minimumDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < centers.length; index += 1) {
        for (let other = index + 1; other < centers.length; other += 1) {
          minimumDistance = Math.min(
            minimumDistance,
            Math.hypot(
              centers[index].x - centers[other].x,
              centers[index].y - centers[other].y,
            ),
          );
        }
      }
      return { minimumDistance, nodeCount: centers.length };
    });

  expect(layoutMetrics.nodeCount).toBe(21);
  expect(layoutMetrics.minimumDistance).toBeGreaterThan(18);
  await expect(graph.locator(".graph-nodes text")).toHaveCount(0);
  await expect(graph.locator(".graph-canvas text")).toHaveCount(0);

  await graph.locator('[data-node-id="origin"]').hover();
  await expect(graph.locator(".graph-hover-label")).toContainText(
    "比勒陀利亚",
  );
  await expect(graph.locator(".graph-edge-hovered")).toHaveCount(3);
  await expect(graph.locator(".graph-edge-muted")).toHaveCount(23);
  const hoverLabelLayer = await graph
    .locator(".graph-canvas > svg")
    .evaluate((svg) => {
      const nodes = svg.querySelector(".graph-nodes");
      const label = svg.querySelector(".graph-hover-label");
      if (!nodes || !label) throw new Error("Missing graph label layer");
      return {
        labelAfterNodes: Boolean(
          nodes.compareDocumentPosition(label) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        labelFill: getComputedStyle(
          label.querySelector("rect") as SVGRectElement,
        ).fill,
      };
    });
  expect(hoverLabelLayer.labelAfterNodes).toBe(true);
  expect(hoverLabelLayer.labelFill).not.toBe("none");

  await graph.locator('[data-node-id="origin"]').focus();
  await expect(graph.locator(".graph-hover-label")).toContainText(
    "比勒陀利亚",
  );
});

test("shows the completed converging DAG before cards are opened", async ({
  page,
}) => {
  const graph = page.getByTestId("graph-preview");
  await expect(
    graph.locator('.graph-edge-discovered[data-edge-to="crisis"]'),
  ).toHaveCount(2);
  await expect(
    graph.locator('.graph-edge-convergence[data-edge-to="crisis"]'),
  ).toHaveCount(2);

  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page
    .getByTestId("research-card-spacex")
    .locator('[data-anchor-target="crisis"]')
    .click();
  await expect(page.getByTestId("research-card-crisis")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(
    graph.locator('.graph-edge-discovered[data-edge-to="crisis"]'),
  ).toHaveCount(4);
  await expect(graph.locator(".graph-edge-context")).toHaveCount(3);

  await page.getByRole("button", { name: "Elon Musk" }).first().click();
  await page
    .getByTestId("research-card-musk")
    .locator('[data-anchor-target="tesla"]')
    .click();
  await expect(page.getByTestId("research-card-tesla")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page
    .getByTestId("research-card-tesla")
    .locator('[data-anchor-target="crisis"]')
    .click();

  await expect(page.getByTestId("research-card-crisis")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(graph.locator(".graph-edge-primary")).toHaveCount(25);
  await expect(graph).toHaveAttribute("data-semantic-edge-count", "46");
  await expect(graph).toContainText("21 个节点");
});

test("compiles a flat article and traces sections back to source cards", async ({
  page,
}) => {
  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page
    .getByTestId("research-card-spacex")
    .locator('[data-anchor-target="crisis"]')
    .click();
  await expect(page.getByTestId("research-card-crisis")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Article", exact: true }).click();

  await expect(page.getByTestId("article-view")).toBeVisible();
  await expect(page.getByTestId("article-section-crisis")).toContainText(
    "双路径综合",
  );
  await expect(
    page.getByTestId("article-sources").locator('[data-source-node="spacex"]'),
  ).toBeVisible();
  await expect(
    page.getByTestId("article-sources").locator('[data-source-node="tesla"]'),
  ).toBeVisible();

  await page
    .getByTestId("article-sources")
    .locator('[data-source-node="spacex"]')
    .click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );

  await page.getByRole("button", { name: "Elon Musk" }).first().click();
  await page
    .getByTestId("research-card-musk")
    .locator('[data-anchor-target="tesla"]')
    .click();
  await expect(page.getByTestId("research-card-tesla")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page
    .getByTestId("research-card-tesla")
    .locator('[data-anchor-target="crisis"]')
    .click();
  await expect(page.getByTestId("research-card-crisis")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Article", exact: true }).click();

  await expect(page.getByTestId("article-section-crisis")).toContainText(
    "双路径综合",
  );
  await expect(
    page.getByTestId("article-sources").locator('[data-source-node="tesla"]'),
  ).toBeVisible();
});

test("supports local followups and user-selected text forks", async ({
  page,
}) => {
  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.locator(".forking-card")).toHaveCount(0);
  const activeCard = page.locator('[data-active="true"]');
  const composer = activeCard.getByPlaceholder("继续问...");
  await composer.fill("这和他的管理方式有什么关系？");
  await activeCard.getByRole("button", { name: "发送追问" }).click();
  await expect(page.getByText("正在沿当前节点思考")).toBeVisible();
  await expect(
    page.getByText("SpaceX 把一个遥远使命拆成了连续工程验证。"),
  ).toBeVisible();
  const followupThread = page.getByTestId("followup-thread-spacex");
  await expect(followupThread).toBeVisible();
  await expect(followupThread).toContainText(
    "这和他的管理方式有什么关系？",
  );
  const threadVisibility = await followupThread.evaluate((thread) => {
    const card = thread.closest(".card-scroll");
    if (!card) throw new Error("Missing card scroll container");
    const threadRect = thread.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      bottomInside: threadRect.bottom <= cardRect.bottom + 1,
      topInside: threadRect.top >= cardRect.top - 1,
    };
  });
  expect(threadVisibility.bottomInside).toBe(true);
  expect(threadVisibility.topInside).toBe(true);

  await activeCard.locator(".research-copy > p").first().evaluate((paragraph) => {
    paragraph.scrollIntoView({ block: "center" });
    const text = paragraph.firstChild;
    if (!text) throw new Error("Expected a text node");
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    paragraph.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
    );
  });

  await expect(
    page.getByRole("button", { name: "从选区分叉" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "从选区分叉" }).click();
  await expect(page.locator('[data-testid^="research-card-selection-"]')).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("persists the theme choice and remains usable on a phone viewport", async ({
  page,
}) => {
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("lattice-theme")))
    .toBe("dark");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("research-card-musk")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);

  await page.getByRole("button", { name: "Article", exact: true }).click();
  await expect(page.getByTestId("article-view")).toBeVisible();
  const articleWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(articleWidth).toBeLessThanOrEqual(390);
});

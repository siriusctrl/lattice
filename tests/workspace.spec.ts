import { expect, test } from "@playwright/test";

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
  await expect(page.getByTestId("graph-preview")).toContainText("21 个节点");

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

  const readDeckGeometry = () =>
    page.locator(".research-card").evaluateAll((cards) => {
      const centers = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      return {
        ordered: centers.every(
          (center, index) => index === 0 || center > centers[index - 1],
        ),
        span: Math.max(...centers) - Math.min(...centers),
      };
    });

  const edgeTrigger = page.getByRole("button", {
    name: "从左侧展开 Card 路径",
  });
  await edgeTrigger.hover();
  await expect(deck).toHaveClass(/deck-wrap-hinted/);
  await expect.poll(async () => (await readDeckGeometry()).span).toBeGreaterThan(
    80,
  );
  expect((await readDeckGeometry()).span).toBeLessThan(140);

  await edgeTrigger.click();
  await expect(deck).toHaveAttribute("data-deck-mode", "spread");
  await expect(page.getByTestId("deck-spread-caption")).toHaveCount(0);
  await expect(page.locator(".deck-card-picker")).toHaveCount(5);
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

test("swipes directly between opposite Deck sides on a phone viewport", async ({
  page,
}) => {
  await page.locator('[data-anchor-target="origin"]').click();
  await page
    .getByTestId("research-card-origin")
    .locator('[data-anchor-target="migration"]')
    .click();
  await page.setViewportSize({ width: 390, height: 844 });

  const deck = page.getByTestId("research-deck");
  await expect(deck).toHaveAttribute("data-deck-mode", "stacked");
  await expect(page.getByRole("button", {
    name: "从左侧展开 Card 路径",
  })).toHaveCount(0);

  const deckBounds = await deck.boundingBox();
  if (!deckBounds) throw new Error("Missing mobile deck bounds");
  const centerY = deckBounds.y + deckBounds.height * 0.54;
  await page.mouse.move(deckBounds.x + deckBounds.width * 0.35, centerY);
  await page.mouse.down();
  await page.mouse.move(
    deckBounds.x + deckBounds.width * 0.7,
    centerY,
    { steps: 8 },
  );
  await page.mouse.up();

  await expect(page.getByTestId("research-card-origin")).toHaveAttribute(
    "data-active",
    "true",
  );
  const cardCenters = await page.locator(".research-card").evaluateAll(
    (cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left + rect.width / 2;
      }),
  );
  expect(cardCenters[0]).toBeLessThan(cardCenters[1]);
  expect(cardCenters[2]).toBeGreaterThan(cardCenters[1]);
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

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

test("forks cards, closes the active branch, and preserves the graph", async ({
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
  await expect(
    page.getByTestId("graph-preview").locator(".graph-node-potential"),
  ).toHaveCount(0);
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
  await expect(page.getByTestId("graph-preview")).toContainText("2 个节点");
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-discovered"),
  ).toHaveCount(1);
  const edgeGeometry = await page
    .getByTestId("graph-preview")
    .locator(".graph-edge-discovered")
    .evaluate((line) => {
      const svgLine = line as SVGLineElement;
      const svg = svgLine.ownerSVGElement;
      const fromId = svgLine.getAttribute("data-edge-from");
      const toId = svgLine.getAttribute("data-edge-to");
      if (!svg || !fromId || !toId) throw new Error("Incomplete graph edge");

      const from = svg.querySelector<SVGCircleElement>(
        `[data-node-id="${fromId}"] circle`,
      );
      const to = svg.querySelector<SVGCircleElement>(
        `[data-node-id="${toId}"] circle`,
      );
      if (!from || !to) throw new Error("Missing graph endpoint");

      const lineMatrix = svgLine.getScreenCTM();
      const fromMatrix = from.getScreenCTM();
      const toMatrix = to.getScreenCTM();
      if (!lineMatrix || !fromMatrix || !toMatrix) {
        throw new Error("Missing graph transform");
      }

      const lineStart = new DOMPoint(
        Number(line.getAttribute("x1")),
        Number(line.getAttribute("y1")),
      ).matrixTransform(lineMatrix);
      const lineEnd = new DOMPoint(
        Number(line.getAttribute("x2")),
        Number(line.getAttribute("y2")),
      ).matrixTransform(lineMatrix);
      const fromCenter = new DOMPoint(0, 0).matrixTransform(fromMatrix);
      const toCenter = new DOMPoint(0, 0).matrixTransform(toMatrix);

      return {
        startDistance: Math.hypot(
          lineStart.x - fromCenter.x,
          lineStart.y - fromCenter.y,
        ),
        endDistance: Math.hypot(
          lineEnd.x - toCenter.x,
          lineEnd.y - toCenter.y,
        ),
        dashArray: getComputedStyle(svgLine).strokeDasharray,
        pathLength: svgLine.getAttribute("pathLength"),
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
  await expect(page.getByTestId("graph-preview")).toContainText("2 个节点");

  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("reflows a crowded graph as new branches are discovered", async ({
  page,
}) => {
  const openFromCard = async (
    sourceId: string,
    targetId: string,
    nodeId: string,
  ) => {
    await page
      .getByTestId(`research-card-${sourceId}`)
      .locator(`[data-anchor-target="${targetId}"]`)
      .first()
      .click();
    await expect(page.getByTestId(`research-card-${nodeId}`)).toHaveAttribute(
      "data-active",
      "true",
    );
  };
  const returnToRoot = async () => {
    await page.getByRole("button", { name: "Elon Musk" }).first().click();
    await expect(page.getByTestId("research-card-musk")).toHaveAttribute(
      "data-active",
      "true",
    );
  };

  await openFromCard("musk", "origin", "origin");
  const originBefore = await page
    .getByTestId("graph-preview")
    .locator('[data-node-id="origin"]')
    .getAttribute("transform");

  await returnToRoot();
  await openFromCard("musk", "education", "education");
  await returnToRoot();
  await openFromCard("musk", "zip2", "zip2");
  await openFromCard("zip2", "paypal", "paypal");
  await openFromCard("paypal", "x", "x");
  await openFromCard("x", "xai", "xai");
  await returnToRoot();
  await openFromCard("musk", "spacex", "spacex");
  await returnToRoot();
  await openFromCard("musk", "tesla", "tesla");

  await expect(page.getByTestId("graph-preview")).toContainText("9 个节点");
  await page.getByRole("button", { name: "展开研究图" }).click();

  const graph = page.getByTestId("graph-preview");
  const originAfter = await graph
    .locator('[data-node-id="origin"]')
    .getAttribute("transform");
  expect(originAfter).not.toBe(originBefore);

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

  expect(layoutMetrics.nodeCount).toBe(9);
  expect(layoutMetrics.minimumDistance).toBeGreaterThan(24);
  await expect(graph.locator(".graph-node-label-crowded")).toHaveCount(8);
});

test("builds a converging DAG when two branches reach the 2008 crisis", async ({
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
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-discovered"),
  ).toHaveCount(4);
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-convergence"),
  ).toHaveCount(2);
  await expect(page.getByTestId("graph-preview")).toContainText("4 个节点");
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
    "等待交叉验证",
  );
  await expect(
    page.getByTestId("article-sources").locator('[data-source-node="spacex"]'),
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

  await activeCard.locator(".research-copy > p").first().evaluate((paragraph) => {
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

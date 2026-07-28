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
  await expect(
    page.getByTestId("graph-preview").locator(".graph-node-potential"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "关闭当前分支" }),
  ).toHaveCount(0);
  await page.locator('[data-anchor-target="spacex"]').click();
  await expect(page.getByTestId("research-card-spacex")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.getByTestId("graph-preview")).toContainText("2 个节点");
  await expect(
    page.getByTestId("graph-preview").locator(".graph-edge-discovered"),
  ).toHaveCount(1);

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

test("builds a converging DAG when two branches reach the 2008 crisis", async ({
  page,
}) => {
  await page.locator('[data-anchor-target="spacex"]').click();
  await page.locator('[data-anchor-target="crisis"]').click();
  await expect(page.getByTestId("research-card-crisis")).toHaveAttribute(
    "data-active",
    "true",
  );

  await page.getByRole("button", { name: "Elon Musk" }).first().click();
  await page.locator('[data-anchor-target="tesla"]').click();
  await page.locator('[data-anchor-target="crisis"]').click();

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
  await page.locator('[data-anchor-target="crisis"]').click();
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
  await page.locator('[data-anchor-target="tesla"]').click();
  await page.locator('[data-anchor-target="crisis"]').click();
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

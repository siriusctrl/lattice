import { expect, test } from "@playwright/test";

test("opens the bilingual design essay from the workspace", async ({ page }) => {
  await page.goto("/");
  await page
    .locator("html[data-lattice-ready='true']")
    .waitFor({ state: "attached" });

  await page.getByRole("link", { name: "阅读 Lattice 设计观点" }).click();
  await expect(page).toHaveURL(/\/notes\/beyond-linear-chat\/?$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "对话会分叉，阅读仍应成篇",
    }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("essay-diagram-desktop")).toBeVisible();
  await expect(page.getByTestId("essay-diagram-mobile")).toBeHidden();

  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/notes\/beyond-linear-chat\/?$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "A chat log is not a knowledge structure",
    }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "English" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("link", { name: "Open the interactive demo" }).click();
  await expect(page.getByTestId("research-deck")).toBeVisible();
});

test("keeps the essay readable and contained on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes/beyond-linear-chat/");

  const shell = page.getByTestId("essay-shell");
  await expect(shell).toBeVisible();
  await expect(page.getByTestId("essay-diagram-desktop")).toBeHidden();
  await expect(page.getByTestId("essay-diagram-mobile")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "图谱负责方向与出处，不负责正文" }),
  ).toBeAttached();

  await page.getByRole("link", { name: "为什么最后仍然需要一篇平铺文章" }).click();
  await expect(page).toHaveURL(/#article$/);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "为什么最后仍然需要一篇平铺文章",
    }),
  ).toBeInViewport();

  await page.getByRole("button", { name: "切换明暗主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByTestId("essay-shell")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    shellWidth: document.querySelector<HTMLElement>(
      '[data-testid="essay-shell"]',
    )?.scrollWidth,
    shellScrollHeight: document.querySelector<HTMLElement>(
      '[data-testid="essay-shell"]',
    )?.scrollHeight,
    shellClientHeight: document.querySelector<HTMLElement>(
      '[data-testid="essay-shell"]',
    )?.clientHeight,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.shellWidth).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.shellScrollHeight ?? 0).toBeGreaterThan(
    dimensions.shellClientHeight ?? Number.POSITIVE_INFINITY,
  );
});

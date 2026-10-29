import { expect, test } from "@playwright/test";

const slideTitle = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("heading", { name, exact: true });

test("a newcomer learns from home, page by page, and lands in a game", async ({ page }) => {
  await page.goto("/vi");
  await page.getByRole("link", { name: "Luật chơi" }).click();
  await page.getByRole("link", { name: /Học chơi trong 2 phút/ }).click();
  await expect(page).toHaveURL(/\/vi\/rules\/learn#1$/);
  await expect(slideTitle(page, "Người cuối cùng thắng")).toBeVisible();

  const next = page.getByRole("button", { name: "Tiếp", exact: true });
  for (let n = 2; n <= 10; n++) {
    await next.click();
    await expect(page).toHaveURL(new RegExp(`#${n}$`));
  }
  await expect(slideTitle(page, "Sẵn sàng!")).toBeVisible();
  await page.getByRole("link", { name: "Chơi với bot" }).click();
  await expect(page).toHaveURL(/\/vi\/play\/local$/);
});

test("a shared page link opens on that page, and arrows and taps move", async ({ page }) => {
  await page.goto("/vi/rules/learn#7");
  await expect(slideTitle(page, "Thách!")).toBeVisible();
  await expect(page).toHaveURL(/#7$/);

  await page.keyboard.press("ArrowRight");
  await expect(slideTitle(page, "Chặn")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(slideTitle(page, "Thách!")).toBeVisible();

  // A tap on the left third goes back.
  const box = page.viewportSize() as { width: number; height: number };
  await page.mouse.click(box.width * 0.15, box.height * 0.5);
  await expect(slideTitle(page, "Xưng nhân vật")).toBeVisible();
});

test("fast taps on Next and Back are never lost", async ({ page }) => {
  await page.goto("/vi/rules/learn");
  await expect(slideTitle(page, "Người cuối cùng thắng")).toBeVisible();
  const next = page.getByRole("button", { name: "Tiếp", exact: true });
  const back = page.getByRole("button", { name: "Lùi", exact: true });
  // No waiting between taps: each one counts, even while the pages are still sliding.
  await next.click();
  await next.click();
  await next.click();
  await expect(page).toHaveURL(/#4$/);
  await expect(slideTitle(page, "Mỗi lượt một hành động")).toBeVisible();
  await back.click();
  await back.click();
  await expect(page).toHaveURL(/#2$/);
  await expect(slideTitle(page, "Bài của bạn")).toBeVisible();
});

test("the rules reference has every section, with the theme's names", async ({ page }) => {
  await page.goto("/en/rules/reference");
  await expect(page.getByRole("heading", { name: "Rules reference" })).toBeVisible();
  for (const section of ["Overview", "Characters", "Challenge", "Block", "Q&A"]) {
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("rowheader", { name: /The Tycoon/ })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Contents" })
    .getByRole("link", { name: "Q&A" })
    .click();
  await expect(page).toHaveURL(/#faq$/);
  await expect(page.getByText(/claim White Swordswoman to block/)).toBeInViewport();
});

test("the bot setup screen points newcomers to the storyboard", async ({ page }) => {
  await page.goto("/vi/play/local");
  await page.getByRole("link", { name: "Chưa biết chơi? Học trong 2 phút" }).click();
  await expect(page).toHaveURL(/\/vi\/rules\/learn/);
});

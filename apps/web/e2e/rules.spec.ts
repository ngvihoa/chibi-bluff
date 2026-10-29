import { expect, test } from "@playwright/test";

const slideTitle = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("heading", { name, exact: true });

test("a newcomer learns from home, page by page, and lands in a game", async ({ page }) => {
  await page.goto("/vi");
  await page.getByRole("link", { name: "Luật chơi" }).click();
  await page.getByRole("link", { name: /Học chơi trong 2 phút/ }).click();
  await expect(page).toHaveURL(/\/vi\/rules\/learn#1$/);
  await expect(slideTitle(page, "Người cuối cùng thắng")).toBeInViewport({ ratio: 1 });

  const next = page.getByRole("button", { name: "Tiếp", exact: true });
  for (let n = 2; n <= 10; n++) {
    await next.click();
    await expect(page).toHaveURL(new RegExp(`#${n}$`));
  }
  await expect(slideTitle(page, "Sẵn sàng!")).toBeInViewport({ ratio: 1 });
  await page.getByRole("link", { name: "Chơi với bot" }).click();
  await expect(page).toHaveURL(/\/vi\/play\/local$/);
});

test("a shared page link opens on that page, and arrows and taps move", async ({ page }) => {
  await page.goto("/vi/rules/learn#7");
  await expect(slideTitle(page, "Thách!")).toBeInViewport({ ratio: 1 });
  await expect(page).toHaveURL(/#7$/);

  await page.keyboard.press("ArrowRight");
  await expect(slideTitle(page, "Chặn")).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("ArrowLeft");
  await expect(slideTitle(page, "Thách!")).toBeInViewport({ ratio: 1 });

  // A tap on the left third goes back.
  const box = page.viewportSize() as { width: number; height: number };
  await page.mouse.click(box.width * 0.15, box.height * 0.5);
  await expect(slideTitle(page, "Xưng nhân vật")).toBeInViewport({ ratio: 1 });
});

test("fast taps on Next and Back are never lost", async ({ page }) => {
  await page.goto("/vi/rules/learn");
  await expect(slideTitle(page, "Người cuối cùng thắng")).toBeInViewport({ ratio: 1 });
  const next = page.getByRole("button", { name: "Tiếp", exact: true });
  const back = page.getByRole("button", { name: "Lùi", exact: true });
  // No waiting between taps: each one counts, even while the pages are still sliding.
  await next.click();
  await next.click();
  await next.click();
  await expect(page).toHaveURL(/#4$/);
  await expect(slideTitle(page, "Mỗi lượt một hành động")).toBeInViewport({ ratio: 1 });
  await back.click();
  await back.click();
  await expect(page).toHaveURL(/#2$/);
  await expect(slideTitle(page, "Bài của bạn")).toBeInViewport({ ratio: 1 });
});

test.describe("on a wide screen", () => {
  // The storyboard is centred with margins: pages must still line up with the progress bar.
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("the page shown always matches the progress bar", async ({ page }) => {
    await page.goto("/vi/rules/learn");
    await expect(slideTitle(page, "Người cuối cùng thắng")).toBeInViewport({ ratio: 1 });
    await expect(page).toHaveURL(/#1$/);
    const next = page.getByRole("button", { name: "Tiếp", exact: true });
    await next.click();
    await expect(page).toHaveURL(/#2$/);
    await expect(slideTitle(page, "Bài của bạn")).toBeInViewport({ ratio: 1 });
    await next.click();
    await next.click();
    await expect(slideTitle(page, "Mỗi lượt một hành động")).toBeInViewport({ ratio: 1 });
    await page.getByRole("button", { name: /^Trang 7\/10/ }).click();
    await expect(slideTitle(page, "Thách!")).toBeInViewport({ ratio: 1 });
  });
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
  // Scrolled to the end, the contents keep their side padding after the last item.
  const gap = await page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label=Contents]") as HTMLElement;
    nav.scrollLeft = nav.scrollWidth;
    const last = [...nav.querySelectorAll("a")].at(-1) as HTMLElement;
    return nav.getBoundingClientRect().right - last.getBoundingClientRect().right;
  });
  expect(gap).toBeGreaterThanOrEqual(12);
  await expect(page.getByText(/claim White Swordswoman to block/)).toBeInViewport();
});

test("the bot setup screen points newcomers to the storyboard", async ({ page }) => {
  await page.goto("/vi/play/local");
  await page.getByRole("link", { name: "Chưa biết chơi? Học trong 2 phút" }).click();
  await expect(page).toHaveURL(/\/vi\/rules\/learn/);
});

test("strategy tips: two groups of five, linked to the rules they rely on", async ({ page }) => {
  await page.goto("/vi/rules");
  await page.getByRole("link", { name: /Mẹo chiến thuật/ }).click();
  await expect(page).toHaveURL(/\/vi\/rules\/tips$/);
  await expect(page.getByRole("heading", { name: "Cho người mới" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nâng cao" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(10);
  // Theme names are filled in, never left as placeholders.
  await expect(page.getByText(/\{duke\}|\{currency\}/)).toHaveCount(0);
  await page.getByRole("link", { name: "Xem luật" }).first().click();
  await expect(page).toHaveURL(/\/vi\/rules\/reference#challenge$/);
});

test("the table's ? opens the rules for what the game is waiting for", async ({ page }) => {
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  await page.getByRole("button", { name: "Luật nhanh" }).click();
  const sheet = page.getByRole("dialog", { name: /^Luật nhanh: / });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("listitem").first()).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Xem toàn bộ luật" })).toHaveAttribute(
    "href",
    /\/vi\/rules\/reference#(actions|challenge|block|influence|characters|overview)$/,
  );
  await sheet.getByRole("button", { name: "Đóng" }).click();
  await expect(sheet).toBeHidden();
});

test("newcomers get one nudge towards the storyboard, then never again", async ({ page }) => {
  await page.goto("/vi/play/local");
  const hint = page.getByRole("note");
  await expect(hint).toContainText("Lần đầu chơi?");
  await page.reload();
  await expect(page.getByRole("button", { name: "Vào bàn!" })).toBeVisible();
  await expect(hint).toHaveCount(0);
});

test("players who opened the storyboard never see the nudge", async ({ page }) => {
  await page.goto("/vi/rules/learn");
  await expect(page.getByRole("heading", { name: "Người cuối cùng thắng" })).toBeVisible();
  await page.goto("/vi/online");
  await expect(page.getByRole("button", { name: "Tạo phòng" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});

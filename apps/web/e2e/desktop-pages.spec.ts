import { expect, test } from "@playwright/test";

// The pages around the table from 1024px wide (docs/ui-design.md §4.2b).
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test("home puts the banner and the menu side by side", async ({ page }) => {
  await page.goto("/vi");
  const banner = await page.getByRole("heading", { name: "Chibi Bluff" }).boundingBox();
  const play = await page.getByRole("link", { name: /Chơi với bot/ }).boundingBox();
  expect(banner && play && play.x > banner.x + banner.width).toBe(true);
});

test("the bot setup previews the very bots that sit down", async ({ page }) => {
  await page.goto("/vi/play/local?speed=0.1");
  const preview = page.getByRole("complementary", { name: "Cùng bàn với bạn" });
  await expect(preview.getByText("BOT", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "6", exact: true }).click();
  await expect(preview.getByText("BOT", { exact: true })).toHaveCount(5);
  await page.getByRole("button", { name: "3", exact: true }).click();
  await expect(preview.getByText("BOT", { exact: true })).toHaveCount(2);

  // The preview is beside the form, not under it.
  const form = await page.getByRole("button", { name: "Vào bàn!" }).boundingBox();
  const box = await preview.boundingBox();
  expect(form && box && box.x > form.x + form.width).toBe(true);

  const names = await preview
    .getByRole("listitem")
    .filter({ hasText: "BOT" })
    .evaluateAll((items) => items.map((li) => li.querySelector("span.truncate")?.textContent));
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  for (const name of names) {
    await expect(
      page
        .locator("[data-seat]")
        .filter({ hasText: name ?? "" })
        .first(),
    ).toBeVisible();
  }
});

test("online: create and join sit side by side", async ({ page }) => {
  await page.goto("/vi/online");
  const create = await page.getByRole("button", { name: "Tạo phòng" }).boundingBox();
  const join = await page.getByRole("heading", { name: "Vào phòng" }).boundingBox();
  expect(create && join && Math.abs(create.y - join.y) < 80 && join.x > create.x).toBe(true);
});

test("rules: hub on one row, storyboard side by side, reference contents on the left", async ({
  page,
}) => {
  await page.goto("/vi/rules");
  const tops = await page
    .getByRole("link", { name: /Học chơi trong 2 phút|Tra cứu luật|Mẹo chiến thuật/ })
    .evaluateAll((links) => links.map((a) => Math.round(a.getBoundingClientRect().top)));
  expect(tops).toHaveLength(3);
  expect(new Set(tops).size).toBe(1);

  await page.goto("/vi/rules/learn");
  const title = page.getByRole("heading", { name: "Người cuối cùng thắng" });
  await expect(title).toBeInViewport();
  const scene = await page.getByText("Thắng!").first().boundingBox();
  const words = await title.boundingBox();
  expect(scene && words && words.x > scene.x + scene.width).toBe(true);

  await page.goto("/vi/rules/reference");
  const contents = page.getByRole("navigation", { name: "Mục lục" });
  const faq = page.getByRole("heading", { name: "Hỏi–đáp" });
  const nav = await contents.boundingBox();
  const section = await faq.boundingBox();
  expect(nav && section && section.x > nav.x + nav.width).toBe(true);
  // The contents stay in view while reading further down.
  await contents.getByRole("link", { name: "Hỏi–đáp" }).click();
  await expect(faq).toBeInViewport();
  await expect(contents).toBeInViewport();

  await page.goto("/vi/rules/tips");
  const beginner = await page.getByRole("heading", { name: "Cho người mới" }).boundingBox();
  const advanced = await page.getByRole("heading", { name: "Nâng cao" }).boundingBox();
  expect(beginner && advanced && Math.abs(beginner.y - advanced.y) < 4).toBe(true);
});

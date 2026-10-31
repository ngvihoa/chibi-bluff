import { expect, test } from "@playwright/test";
import { playUntilGameOver } from "./helpers";

// The table from 1024px wide (docs/ui-design.md §4.2): an oval table, a one-row action bar and
// the game log as a column that is always there.
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test("plays a whole game on a desktop screen", async ({ page }) => {
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();

  // The log is a column, not a sheet behind a button.
  const log = page.getByRole("complementary", { name: "Diễn biến" });
  await expect(log).toBeVisible();
  await expect(page.getByRole("button", { name: "Diễn biến" })).toBeHidden();

  // All eight action buttons sit on one row. A bot may move first, showing a response sheet
  // instead of the bar: pass until the bar is back.
  const income = page.getByRole("button", { name: /^Thu nhập/ });
  await expect(async () => {
    const pass = page.getByRole("button", { name: "Bỏ qua", exact: true });
    if (await pass.isVisible()) await pass.click({ timeout: 1_000 }).catch(() => {});
    await expect(income).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 30_000 });
  const bar = page
    .getByRole("navigation")
    .filter({ has: page.getByRole("button", { name: /^Thu nhập/ }) });
  // A hovered action lifts a little: keep the mouse off the bar while measuring.
  await page.mouse.move(0, 0);
  const tops = await bar
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
  expect(tops).toHaveLength(8);
  expect(new Set(tops).size).toBe(1);

  // A dimmed action explains itself on hover.
  await expect(page.getByRole("button", { name: /^Đảo chính/ })).toHaveAttribute(
    "title",
    /Cần 7 lượng|Chưa tới lượt bạn/,
  );

  await playUntilGameOver(page);
  await expect(page.getByRole("button", { name: "Chơi ván mới" })).toBeVisible();
  await expect(log.getByRole("listitem").first()).toBeVisible();
  expect(await log.getByRole("listitem").count()).toBeGreaterThan(5);
});

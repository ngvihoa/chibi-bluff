import { expect, type Locator, type Page, test } from "@playwright/test";

/** The table re-renders as bots move and sheets slide in; a missed click is retried next loop. */
const tap = (locator: Locator) => locator.click({ timeout: 1_500 }).catch(() => {});

/** True if the action button is on screen and usable. Never waits for a missing element. */
const usable = async (locator: Locator) =>
  (await locator.isVisible()) &&
  (await locator.getAttribute("aria-disabled", { timeout: 500 }).catch(() => null)) === "false";

/**
 * Plays a whole local game through the UI: always Income on our turn (Coup when forced),
 * never challenges, gives up the first card when asked. Bots run 10× faster via ?speed=0.1.
 */
async function playUntilGameOver(page: Page) {
  const over = page.getByRole("button", { name: "Chơi ván mới" });
  const deadline = Date.now() + 150_000;

  while (Date.now() < deadline) {
    // Game over dialog, or our own elimination sheet (both offer "new game").
    if (await over.isVisible()) {
      if (await page.getByRole("button", { name: "Xem tiếp" }).isVisible()) {
        await tap(page.getByRole("button", { name: "Xem tiếp" }));
        continue;
      }
      return;
    }
    // Moment overlays can be tapped away.
    const moment = page.locator("button.fixed.inset-0");
    if (await moment.isVisible()) {
      await moment.click({ force: true, timeout: 1_500 }).catch(() => {});
      continue;
    }
    const pass = page.getByRole("button", { name: "Bỏ qua", exact: true });
    if (await pass.isVisible()) {
      await tap(pass);
      continue;
    }
    if (await page.getByText("Bạn phải bỏ 1 lá").first().isVisible()) {
      await tap(page.locator("section[aria-live] button:has(svg[data-character])").first());
      continue;
    }
    const income = page.getByRole("button", { name: /^Thu nhập/ });
    if (await usable(income)) {
      await tap(income);
      continue;
    }
    // Targetable seats bounce forever, so Playwright never sees them "stable": force the click.
    const target = page.locator("section button.ring-danger").first();
    if (await target.isVisible()) {
      await target.click({ force: true, timeout: 1_500 }).catch(() => {});
      continue;
    }
    const coup = page.getByRole("button", { name: /^Đảo chính/ });
    if (await usable(coup)) {
      await tap(coup);
      continue;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Game did not finish in time");
}

test("plays a full game against bots on a phone", async ({ page }) => {
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();

  // The table: our two face-down cards and either the action bar or a response sheet
  // (a bot may move first).
  await expect(page.getByRole("img", { name: /Chỉ bạn thấy lá này/ })).toHaveCount(2);
  await expect(
    page
      .getByRole("button", { name: /^Thu nhập/ })
      .or(page.getByRole("button", { name: "Bỏ qua" })),
  ).toBeVisible();

  await playUntilGameOver(page);
  await expect(page.getByRole("button", { name: "Chơi ván mới" })).toBeVisible();
  await expect(page.getByText(/thắng/).first()).toBeVisible();

  // The log can be reviewed from the game-over screen.
  await page.getByRole("button", { name: "Diễn biến" }).last().click();
  await expect(page.locator("dialog[open] li").first()).toBeVisible();
});

test("explains why an action is unavailable", async ({ page }) => {
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  // aria-disabled buttons stay tappable on purpose: tapping explains why.
  await page.getByRole("button", { name: /^Đảo chính/ }).click({ force: true });
  await expect(page.getByRole("status")).toContainText(/Cần 7 lượng|Chưa tới lượt bạn/);
});

test("redirects locale-less links and switches language", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await page.goto("/play/local");
  await expect(page).toHaveURL(/\/en\/play\/local$/);
  await expect(page.getByRole("heading", { name: "Play vs bots" })).toBeVisible();

  await page.goto("/en");
  await page.getByRole("link", { name: "vi" }).click();
  await expect(page).toHaveURL(/\/vi$/);
  await expect(page.getByRole("link", { name: /Chơi với bot/ })).toBeVisible();
});

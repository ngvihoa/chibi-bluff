// Shared steps for the end-to-end tests.

import type { Locator, Page } from "@playwright/test";

/** The table re-renders as bots move and sheets slide in; a missed click is retried next loop. */
export const tap = (locator: Locator) => locator.click({ timeout: 1_500 }).catch(() => {});

/** True if the action button is on screen and usable. Never waits for a missing element. */
export const usable = async (locator: Locator) =>
  (await locator.isVisible()) &&
  (await locator.getAttribute("aria-disabled", { timeout: 500 }).catch(() => null)) === "false";

/**
 * Plays a whole local game through the UI: always Income on our turn (Coup when forced),
 * never challenges, gives up the first card when asked. `again` names the game-over button.
 */
export async function playUntilGameOver(page: Page, again = "Chơi ván mới") {
  const over = page.getByRole("button", { name: again });
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

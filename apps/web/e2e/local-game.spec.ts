import { expect, test } from "@playwright/test";
import { playUntilGameOver } from "./helpers";

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

test("coming back from home opens the setup again, not the last game", async ({ page }) => {
  await page.goto("/vi");
  await page.getByRole("link", { name: /Chơi với bot/ }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  await expect(page.getByRole("img", { name: /Chỉ bạn thấy lá này/ })).toHaveCount(2);

  // Leaving mid-game asks first.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Rời bàn" }).click();
  await expect(page).toHaveURL(/\/vi$/);

  // Next keeps the left page alive (cacheComponents); it must come back as the setup screen.
  await page.getByRole("link", { name: /Chơi với bot/ }).click();
  await expect(page.getByRole("button", { name: "Vào bàn!" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Chỉ bạn thấy lá này/ })).toHaveCount(0);
});

test("plays a whole game against hard bots, which think in a Web Worker", async ({ page }) => {
  // Count the workers the page starts.
  await page.addInitScript(() => {
    const w = window as Window & { __workers?: number };
    w.__workers = 0;
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        w.__workers = (w.__workers ?? 0) + 1;
      }
    };
  });
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: /^Khó/ }).click();
  await expect(page.getByRole("button", { name: /^Khó/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  await expect(page.getByRole("img", { name: /Chỉ bạn thấy lá này/ })).toHaveCount(2);

  await playUntilGameOver(page);
  await expect(page.getByText(/thắng/).first()).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { __workers?: number }).__workers),
  ).toBeGreaterThan(0);
});

import { devices, expect, type Page, test } from "@playwright/test";
import { playUntilGameOver } from "./helpers";

// Installable app and offline play (docs/architecture.md §6.1), checked on the production build
// the tests run.

/** Waits until the service worker controls the page and has kept the offline pages and files. */
async function readyForOffline(page: Page) {
  await page.goto("/vi");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const pages = await caches.open("chibi-bluff-pages-v2");
          const files = await caches.open("chibi-bluff-static-v2");
          return Boolean(
            (await pages.match("/en/rules/tips")) &&
              (await pages.match("/vi/play/local")) &&
              (await files.match("/themes/giang-ho/cards/duke.vi.svg")),
          );
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.reload();
}

test("the manifest describes an installable app with every icon it lists", async ({
  page,
  request,
}) => {
  await page.goto("/vi");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "Chibi Bluff",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
  });
  const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
  expect(purposes).toContain("maskable");
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const size = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, icon.src);
    expect(size).toBe(icon.sizes);
  }
});

test("a service worker takes over, and pages it cannot reach offline say so", async ({
  page,
  context,
  request,
}) => {
  // Never cached, so a new deploy reaches players at once.
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");

  await page.goto("/vi");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Online rooms are never kept for offline use.
  await context.setOffline(true);
  await page.goto("/vi/room/ABCDE");
  await expect(page.getByRole("heading", { name: "Bạn đang offline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await context.setOffline(false);
});

test.describe("on an iPhone", () => {
  // An iPhone as the page sees it (user agent, screen, touch), still run in Chrome.
  const { userAgent, viewport, deviceScaleFactor } = devices["iPhone 15"];
  test.use({ userAgent, viewport, deviceScaleFactor, isMobile: true, hasTouch: true });

  test("the home page explains how to add the game from the Share menu", async ({ page }) => {
    await page.goto("/vi");
    await page.getByRole("button", { name: "Cài game lên màn hình chính" }).click();
    const steps = page.getByRole("dialog", { name: "Cài lên iPhone / iPad" });
    await expect(steps.getByRole("listitem")).toHaveCount(3);
    await expect(steps).toContainText("Thêm vào MH chính");
    await steps.getByRole("button", { name: "Đóng" }).click();
    await expect(steps).toBeHidden();
  });
});

test("browsers that cannot install show no install hint", async ({ page }) => {
  // Desktop Chrome under test never offers installing, and it is not iOS.
  await page.goto("/vi");
  await expect(
    page
      .getByRole("button", { name: "Chơi với bot" })
      .or(page.getByRole("link", { name: /Chơi với bot/ })),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cài game lên màn hình chính" })).toHaveCount(0);
});

test("after one visit, the game opens and plays against bots with no network", async ({
  page,
  context,
}) => {
  await readyForOffline(page);
  await context.setOffline(true);

  // Opened from the home screen ("/"): the kept home page in the browser's language.
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Chibi Bluff" })).toBeVisible();

  // In-app navigation falls back to loading the kept page.
  await page.getByRole("link", { name: /Chơi với bot/ }).click();
  await expect(page.getByRole("button", { name: "Vào bàn!" })).toBeVisible();

  // A whole game (faster bots through the query string, which the kept page ignores).
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  await expect(page.getByRole("img", { name: /Chỉ bạn thấy lá này/ })).toHaveCount(2);
  await playUntilGameOver(page);
  await expect(page.getByText(/thắng/).first()).toBeVisible();

  // The rules, in both languages.
  await page.goto("/vi/rules/learn");
  await expect(page.getByRole("heading", { name: "Người cuối cùng thắng" })).toBeVisible();
  await page.goto("/en/rules/reference");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Online play says it needs the network, and points to the bots.
  await page.goto("/vi/online");
  await expect(page.getByText("Cần có mạng để chơi với bạn bè", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo phòng" })).toBeDisabled();
  await context.setOffline(false);
});

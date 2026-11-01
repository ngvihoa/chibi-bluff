import { devices, expect, test } from "@playwright/test";

// Installable app (docs/architecture.md §6.1), checked on the production build the tests run.

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

  await context.setOffline(true);
  await page.goto("/vi/rules/tips");
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

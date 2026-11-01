import { expect, type Page, test } from "@playwright/test";

// Game sounds (docs/ui-design.md §7). Whether anything is audible cannot be checked here; what can:
// the audio context only exists once sound is on and the player has touched the page, the files
// load then, and the speaker button's choice survives a reload.

test.beforeEach(async ({ page }) => {
  // Count audio contexts the page makes.
  await page.addInitScript(() => {
    const w = window as Window & { __audioContexts?: number };
    w.__audioContexts = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        w.__audioContexts = (w.__audioContexts ?? 0) + 1;
      }
    };
  });
});

const contexts = (page: Page) =>
  page.evaluate(() => (window as Window & { __audioContexts?: number }).__audioContexts);

async function startGame(page: Page) {
  await page.goto("/vi/play/local?speed=0.1");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Vào bàn!" }).click();
  await expect(page.getByRole("img", { name: /Chỉ bạn thấy lá này/ })).toHaveCount(2);
}

test("sound is on by default: the first tap wakes it and the sounds load", async ({ page }) => {
  const loaded = new Set<string>();
  page.on("requestfinished", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/sounds/")) loaded.add(path);
  });
  await startGame(page);
  expect(await contexts(page)).toBe(1);
  await expect(page.getByRole("button", { name: "Tắt tiếng" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => loaded.size).toBe(15);
});

test("the speaker button mutes, remembers it, and a muted player never gets audio", async ({
  page,
}) => {
  await startGame(page);
  await page.getByRole("button", { name: "Tắt tiếng" }).click();
  await expect(page.getByRole("button", { name: "Bật tiếng" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // A new visit, muted from the start: tapping around makes no audio context at all.
  await startGame(page);
  await expect(page.getByRole("button", { name: "Bật tiếng" })).toBeVisible();
  expect(await contexts(page)).toBe(0);

  // Turning it back on wakes the sound right away (the tap counts).
  await page.getByRole("button", { name: "Bật tiếng" }).click();
  await expect(page.getByRole("button", { name: "Tắt tiếng" })).toBeVisible();
  expect(await contexts(page)).toBe(1);
});

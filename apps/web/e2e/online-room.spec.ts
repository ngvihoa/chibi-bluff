import { devices, expect, type Page, test } from "@playwright/test";
import { playUntilGameOver, tap } from "./helpers";

/** Waits for a moment when the action bar is showing (passing on anything asked meanwhile),
 * then sends a sticker. */
async function sendSticker(page: Page, text: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const pass = page.getByRole("button", { name: "Bỏ qua", exact: true });
    if (await pass.isVisible()) {
      await tap(pass);
      continue;
    }
    const sticker = page.getByRole("button", { name: "Sticker", exact: true });
    if (await sticker.isVisible()) {
      await sticker.click();
      await page.getByRole("button", { name: text }).click();
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("never got a chance to send a sticker");
}

const myCards = (page: Page) => page.getByRole("img", { name: /Chỉ bạn thấy lá này/ });

test("two players meet in a room, send stickers, and the game survives a reload and a drop-out", async ({
  page: host,
  browser,
  baseURL,
}) => {
  // The host creates a room.
  await host.goto("/vi/online");
  await host.getByLabel("Tên của bạn").fill("Chủ");
  await host.getByRole("button", { name: "Tạo phòng" }).click();
  await host.waitForURL(/\/vi\/room\/[A-Z2-9]{5}$/);
  const code = host.url().split("/").at(-1) as string;

  // A friend opens the invite link (no language prefix) on their own phone.
  const friendContext = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "vi-VN",
    baseURL,
  });
  const friend = await friendContext.newPage();
  await friend.goto(`/room/${code}`);
  await expect(friend).toHaveURL(new RegExp(`/vi/room/${code}$`));
  await friend.getByLabel("Tên của bạn").fill("Khách");
  await friend.getByRole("button", { name: "Vào", exact: true }).click();
  await expect(host.getByText("Khách")).toBeVisible();

  // The host fills a seat with a bot and starts.
  await host.getByRole("button", { name: /Thêm bot/ }).click();
  await expect(friend.getByText("Người chơi (3/6)")).toBeVisible();
  await host.getByRole("button", { name: "Bắt đầu!" }).click();
  await expect(myCards(host)).toHaveCount(2);
  await expect(myCards(friend)).toHaveCount(2);

  // Stickers reach the other player.
  await sendSticker(friend, "Hehe~");
  await expect(host.getByRole("status").filter({ hasText: "Hehe~" })).toBeVisible();

  // A reload takes the same seat back, mid-game.
  await friend.reload();
  await expect(myCards(friend)).toHaveCount(2);

  // The friend drops out: a bot plays for them after a short wait (STANDIN_MS in the config).
  await friendContext.close();
  await expect(host.getByText("Bot chơi thay")).toBeAttached({ timeout: 10_000 });

  // The host plays on to the end against the bot and the stand-in.
  await playUntilGameOver(host, "Tạo phòng mới");
  await expect(host.getByText(/thắng/).first()).toBeVisible();
});

// Renders the app icon (assets/brand/*.svg) into the PNG and ICO files browsers and phones ask
// for (docs/architecture.md §6.1). The PNGs are committed; run this again after changing the art.
// Uses Playwright with the locally installed Google Chrome, like the end-to-end tests.
// Usage: node scripts/export-pwa-icons.mjs

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps/web");
// Playwright is a dependency of the web app, not of the repository root.
const { chromium } = createRequire(join(web, "package.json"))("@playwright/test");

const svg = (name) => readFileSync(join(root, "assets/brand", name), "utf8");
const appIcon = svg("app-icon.svg");
const favicon = svg("favicon.svg");

/** Corner radius of the plain ("any") icons, as a share of their size. */
const ROUND = 0.22;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();

/** One PNG of `source` at `size` px; `round` clips the corners (transparent outside). */
async function render(source, size, { round = false } = {}) {
  const src = `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}div{width:${size}px;height:${size}px;overflow:hidden;border-radius:${round ? size * ROUND : 0}px}img{width:100%;height:100%;display:block}</style><div><img src="${src}"></div>`,
  );
  await page.locator("img").evaluate((img) => img.decode());
  return page.screenshot({ omitBackground: true, type: "png" });
}

const icons = join(web, "public/icons");
mkdirSync(icons, { recursive: true });
const out = (path, data) => {
  writeFileSync(path, data);
  console.log(`wrote ${path.replace(`${root}/`, "")}`);
};

// Manifest icons: plain ones with rounded corners, and a full-bleed one Android masks itself.
out(join(icons, "icon-192.png"), await render(appIcon, 192, { round: true }));
out(join(icons, "icon-512.png"), await render(appIcon, 512, { round: true }));
out(join(icons, "icon-maskable-512.png"), await render(appIcon, 512));
// iOS rounds the home-screen icon itself, so it gets the full square too.
out(join(web, "src/app/apple-icon.png"), await render(appIcon, 180));

// Tab icons: the SVG for browsers that take one, and an ICO (16, 32, 48 px) for the rest.
copyFileSync(join(root, "assets/brand/favicon.svg"), join(web, "src/app/icon.svg"));
console.log("wrote apps/web/src/app/icon.svg");
const sizes = [16, 32, 48];
const tabIcons = [];
// One at a time: every render reuses the same page.
for (const size of sizes) tabIcons.push(await render(favicon, size));
out(join(web, "src/app/favicon.ico"), ico(tabIcons, sizes));

await browser.close();

/** An ICO file holding PNG images (supported by every current browser). */
function ico(pngs, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map((png, i) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(sizes[i] % 256, 0); // width (0 means 256)
    entry.writeUInt8(sizes[i] % 256, 1); // height
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

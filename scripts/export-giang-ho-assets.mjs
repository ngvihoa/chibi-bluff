// Exports the Giang Hồ theme artwork from the concept preview into standalone SVG files.
// Source of truth for the art: design/concepts/giang-ho-preview.html
// Usage: node scripts/export-giang-ho-assets.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "assets/themes/giang-ho");
const html = readFileSync(join(root, "design/concepts/giang-ho-preview.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Minimal DOM stub: the preview script only assigns innerHTML on elements by id.
const elements = {};
const document = { getElementById: id => (elements[id] ??= { innerHTML: "" }) };
const ctx = vm.createContext({ document, Math });
vm.runInContext(`${script}\n;globalThis.__x = { CAST, card, back, money, goldIngot };`, ctx);
const { CAST, card, back, money, goldIngot } = ctx.__x;

const FONT = `<style>@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800');</style>`;
const svgsIn = markup => markup.match(/<svg[\s\S]*?<\/svg>/g);

function standalone(svg, { withFont = false } = {}) {
  let s = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (withFont) s = s.replace(/^(<svg[^>]*>)/, `$1${FONT}`);
  return `${s.trim()}\n`;
}

function write(rel, content) {
  const file = join(out, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log("wrote", rel);
}

const ids = ["duke", "assassin", "captain", "ambassador", "contessa"];
const stickers = svgsIn(elements.stickers.innerHTML);

CAST.forEach((c, i) => {
  const id = ids[i];
  // Art only (no frame, no text): what the app composes into its own card component.
  write(`characters/${id}.svg`, standalone(`<svg viewBox="0 0 300 360">${c.art}</svg>`));
  // Full card with Vietnamese text: reference / marketing use.
  write(`cards/${id}.vi.svg`, standalone(card(c), { withFont: true }));
  write(`stickers/${id}.vi.svg`, standalone(stickers[i], { withFont: true }));
});

write("card-back.svg", standalone(back, { withFont: true }));
write("currency.svg", standalone(money));
write("tax-gold.svg", standalone(goldIngot));
write("background.svg", standalone(svgsIn(elements.hero.innerHTML)[0]));

// Copies theme assets (assets/themes) into the web app's public folder so Next.js can serve them
// at /themes/<id>/... Runs before `dev` and `build`; the copy is git-ignored.
//
// Only files whose content changed are written (and stale ones removed), so a build running
// next to `next dev` does not make the dev server reload every page.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets/themes");
const target = join(root, "apps/web/public/themes");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let written = 0;
let removed = 0;
const wanted = new Set();
for (const file of walk(source)) {
  const rel = relative(source, file);
  wanted.add(rel);
  const dest = join(target, rel);
  const content = readFileSync(file);
  if (existsSync(dest) && readFileSync(dest).equals(content)) continue;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  written++;
}
for (const file of walk(target)) {
  if (!wanted.has(relative(target, file))) {
    rmSync(file);
    removed++;
  }
}
console.log(
  `theme assets synced → apps/web/public/themes (${written} written, ${removed} removed)`,
);

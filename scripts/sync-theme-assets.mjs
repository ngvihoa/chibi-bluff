// Copies theme assets (assets/themes) into the web app's public folder so Next.js can serve them
// at /themes/<id>/... Runs before `dev` and `build`; the copy is git-ignored.

import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "apps/web/public/themes");
rmSync(target, { recursive: true, force: true });
cpSync(join(root, "assets/themes"), target, { recursive: true });
console.log("theme assets synced → apps/web/public/themes");

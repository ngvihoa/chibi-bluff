import { describe, expect, it } from "vitest";
import { originMatcher } from "./origins";

describe("originMatcher", () => {
  it("lets any localhost port in when nothing is configured (development)", () => {
    for (const list of [undefined, "", " , "]) {
      const allowed = originMatcher(list);
      expect(allowed("http://localhost:3000")).toBe(true);
      expect(allowed("http://127.0.0.1:46771")).toBe(true);
      expect(allowed("https://chibi-bluff.vercel.app")).toBe(false);
    }
  });

  it("matches configured origins exactly, and * within one subdomain label", () => {
    const allowed = originMatcher(
      "https://chibi-bluff.vercel.app, https://chibi-bluff-*-ngvihoa.vercel.app",
    );
    expect(allowed("https://chibi-bluff.vercel.app")).toBe(true);
    expect(allowed("https://chibi-bluff-git-feat-x-ngvihoa.vercel.app")).toBe(true);
    expect(allowed("https://chibi-bluff-k3j2h1-ngvihoa.vercel.app")).toBe(true);
    expect(allowed("http://localhost:3000")).toBe(false);
    expect(allowed("https://chibi-bluff.vercel.app.evil.example")).toBe(false);
    expect(allowed("https://chibi-bluff-x-ngvihoa.vercel.app.evil.example")).toBe(false);
    expect(allowed("https://evil.example/chibi-bluff-x-ngvihoa.vercel.app")).toBe(false);
    expect(allowed("https://chibi-bluff-a.b-ngvihoa.vercel.app")).toBe(false); // no dots in *
  });

  it("allows the production site and this project's Vercel previews (wrangler.jsonc)", async () => {
    const config = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url).pathname, "utf8"),
    );
    const list = config.match(/"ALLOWED_ORIGINS":\s*"([^"]+)"/)?.[1];
    const allowed = originMatcher(list);
    expect(allowed("https://chibi-bluff.vercel.app")).toBe(true);
    expect(
      allowed("https://chibi-bluff-git-chore-vercel-ignore-build-ngvihoas-projects.vercel.app"),
    ).toBe(true);
    expect(allowed("https://chibi-bluff-git-x-someone-elses-projects.vercel.app")).toBe(false);
    expect(allowed("https://other-app.vercel.app")).toBe(false);
    expect(allowed("http://localhost:3000")).toBe(false);
  });
});

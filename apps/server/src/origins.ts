// Which web pages may use the server (docs/deployment.md). ALLOWED_ORIGINS is a comma-separated
// list of exact origins; a `*` matches one run of letters, digits and dashes, so Vercel previews
// (https://chibi-bluff-git-<branch>-<team>.vercel.app) can be allowed with one pattern.

/** Without ALLOWED_ORIGINS (local development), any localhost port may connect. */
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const escapeRegExp = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

export function originMatcher(list: string | undefined): (origin: string) => boolean {
  const patterns = (list ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => new RegExp(`^${o.split("*").map(escapeRegExp).join("[a-z0-9-]+")}$`));
  if (patterns.length === 0) return (origin) => LOCAL.test(origin);
  return (origin) => patterns.some((p) => p.test(origin));
}

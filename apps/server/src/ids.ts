// Random ids, tokens, seeds and room codes from Web Crypto, which both Cloudflare Workers and
// Node provide (no node:crypto).

import { roomCode } from "@chibi-bluff/rooms";

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Seat id, e.g. `p-3fZq1xYb`. */
export const newId = (prefix: string) => `${prefix}-${base64url(randomBytes(6))}`;

/** Secret that lets a browser take its seat back (32 characters). */
export const newToken = () => base64url(randomBytes(24));

/** Seed for a game's shuffles. */
export const newSeed = () =>
  [...randomBytes(12)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** A fresh room code (the caller retries if it is taken). */
export const newRoomCode = () =>
  roomCode(() => (crypto.getRandomValues(new Uint32Array(1))[0] as number) / 2 ** 32);

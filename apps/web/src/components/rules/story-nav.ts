// Pure navigation rules of the learn-to-play storyboard (docs/ui-design.md §10.2).

export type Step = "prev" | "next";

export const clampSlide = (index: number, total: number) =>
  Math.min(total - 1, Math.max(0, Math.round(index)));

/** `#3` → slide 2 (0-based). Anything else starts at the beginning. */
export function slideFromHash(hash: string, total: number): number {
  const match = /^#(\d+)$/.exec(hash);
  return match ? clampSlide(Number(match[1]) - 1, total) : 0;
}

export const hashForSlide = (index: number) => `#${index + 1}`;

/** A tap on the left third goes back, anywhere else goes on (like stories). */
export const tapStep = (x: number, width: number): Step => (x < width / 3 ? "prev" : "next");

export function keyStep(key: string): Step | null {
  if (key === "ArrowLeft" || key === "PageUp") return "prev";
  if (key === "ArrowRight" || key === "PageDown" || key === " ") return "next";
  return null;
}

export const stepSlide = (index: number, step: Step, total: number) =>
  clampSlide(index + (step === "next" ? 1 : -1), total);

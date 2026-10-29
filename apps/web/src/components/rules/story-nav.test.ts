import { describe, expect, it } from "vitest";
import { clampSlide, hashForSlide, keyStep, slideFromHash, stepSlide, tapStep } from "./story-nav";

describe("storyboard navigation", () => {
  it("reads and writes the page number in the URL hash", () => {
    expect(slideFromHash("#3", 10)).toBe(2);
    expect(slideFromHash("#1", 10)).toBe(0);
    expect(slideFromHash("#99", 10)).toBe(9);
    expect(slideFromHash("#0", 10)).toBe(0);
    expect(slideFromHash("", 10)).toBe(0);
    expect(slideFromHash("#abc", 10)).toBe(0);
    expect(hashForSlide(2)).toBe("#3");
  });

  it("goes back on the left third and on everywhere else", () => {
    expect(tapStep(50, 375)).toBe("prev");
    expect(tapStep(124, 375)).toBe("prev");
    expect(tapStep(126, 375)).toBe("next");
    expect(tapStep(370, 375)).toBe("next");
  });

  it("maps arrow keys and stays within the slides", () => {
    expect(keyStep("ArrowLeft")).toBe("prev");
    expect(keyStep("ArrowRight")).toBe("next");
    expect(keyStep(" ")).toBe("next");
    expect(keyStep("a")).toBeNull();
    expect(stepSlide(0, "prev", 10)).toBe(0);
    expect(stepSlide(9, "next", 10)).toBe(9);
    expect(stepSlide(4, "next", 10)).toBe(5);
    expect(clampSlide(4.6, 10)).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { applyHangover, dropShortRuns, hysteresis, toSegments } from "./smoothing.js";

describe("applyHangover", () => {
  it("bridges gaps shorter than the hangover", () => {
    const input = [true, false, false, true, false, false, false];
    expect(applyHangover(input, 2)).toEqual([true, true, true, true, true, true, false]);
  });
});

describe("dropShortRuns", () => {
  it("removes runs below the minimum, keeps the rest", () => {
    const input = [true, false, true, true, true, false, true];
    expect(dropShortRuns(input, 2)).toEqual([false, false, true, true, true, false, false]);
  });

  it("handles a run that ends at the last frame", () => {
    expect(dropShortRuns([false, true, true], 2)).toEqual([false, true, true]);
  });
});

describe("toSegments", () => {
  it("emits [start, end) in seconds", () => {
    const decisions = [false, true, true, false, true];
    const times = [0, 0.01, 0.02, 0.03, 0.04];
    expect(toSegments(decisions, times, 0.01)).toEqual([
      { start: 0.01, end: 0.03 },
      { start: 0.04, end: 0.05 },
    ]);
  });
});

describe("hysteresis", () => {
  it("enters above the high threshold and exits below the low one", () => {
    const scores = [0, 5, 11, 8, 7, 4, 8, 11];
    // enter at >10, exit at <6
    expect(hysteresis(scores, 10, 6)).toEqual([false, false, true, true, true, false, false, true]);
  });

  it("rejects an exit threshold above enter", () => {
    expect(() => hysteresis([], 5, 10)).toThrow();
  });
});

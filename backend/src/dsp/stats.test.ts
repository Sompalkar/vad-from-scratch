import { describe, expect, it } from "vitest";
import { movingAverage, percentile } from "./stats.js";

describe("percentile", () => {
  it("picks the value at the quantile", () => {
    expect(percentile([5, 1, 3, 2, 4], 0)).toBe(1);
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("movingAverage", () => {
  it("averages over a centred window and shrinks at the edges", () => {
    expect(movingAverage([0, 0, 3, 0, 0], 3)).toEqual([0, 1, 1, 1, 0]);
    expect(movingAverage([2, 4], 3)).toEqual([3, 3]);
  });
});

import { describe, expect, it } from "vitest";
import { frameMetrics, segmentsToFrames } from "./metrics.js";

describe("segmentsToFrames", () => {
  it("marks frames inside [start, end)", () => {
    const frames = segmentsToFrames([{ start: 0.1, end: 0.3 }], [0, 0.1, 0.2, 0.3, 0.4]);
    expect(frames).toEqual([false, true, true, false, false]);
  });
});

describe("frameMetrics", () => {
  it("is perfect on identical input", () => {
    const m = frameMetrics([true, false, true], [true, false, true]);
    expect(m).toMatchObject({ precision: 1, recall: 1, f1: 1, accuracy: 1 });
  });

  it("computes precision and recall separately", () => {
    // predicted: 2 speech frames, 1 correct. truth: 2 speech frames.
    const m = frameMetrics([true, true, false, false], [true, false, true, false]);
    expect(m.precision).toBe(0.5);
    expect(m.recall).toBe(0.5);
    expect(m.f1).toBe(0.5);
  });

  it("does not divide by zero when nothing is predicted", () => {
    const m = frameMetrics([false, false], [true, false]);
    expect(m.precision).toBe(0);
    expect(m.f1).toBe(0);
  });
});

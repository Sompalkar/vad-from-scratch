import { describe, expect, it } from "vitest";
import { waveformPeaks } from "./waveform.js";

describe("waveformPeaks", () => {
  it("keeps min and max per bucket", () => {
    const samples = Float32Array.from([0.1, -0.9, 0.5, 0.2, 0.8, -0.3]);
    const peaks = waveformPeaks(samples, 6, 2);
    expect(peaks.min).toEqual([-0.9, -0.3]);
    expect(peaks.max).toEqual([0.5, 0.8]);
    expect(peaks.durationSec).toBe(1);
  });
});

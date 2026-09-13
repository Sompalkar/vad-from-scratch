import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";
import { createLearnedVad } from "./learned.js";

describe("learned VAD", () => {
  it("finds speech and rejects a noise burst with the shipped model", () => {
    const audio = synthesize({
      durationSec: 4,
      speech: [{ start: 0.5, end: 1.5 }],
      bursts: [{ start: 2.5, end: 3.5 }],
      seed: 42,
    });
    const { segments, frameScores } = createLearnedVad().detect(audio, SAMPLE_RATE);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.start).toBeCloseTo(0.5, 1);
    // Scores are probabilities
    expect(Math.max(...frameScores)).toBeLessThanOrEqual(1);
    expect(Math.min(...frameScores)).toBeGreaterThanOrEqual(0);
  });
});

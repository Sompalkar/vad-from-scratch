import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";
import { createLearnedVad } from "./learned.js";

describe("learned VAD", () => {
  const audio = synthesize({
    durationSec: 4,
    speech: [{ start: 0.5, end: 1.5 }],
    bursts: [{ start: 2.5, end: 3.5 }],
    seed: 42,
  });
  const result = createLearnedVad().detect(audio, SAMPLE_RATE);

  it("finds the speech region with the shipped model", () => {
    expect(result.segments[0]?.start).toBeCloseTo(0.5, 1);
    expect(result.segments[0]?.end).toBeGreaterThan(1.4);
  });

  it("scores a noise burst below threshold on average", () => {
    // A single-frame linear model separates bursts from speech with a thin
    // margin (~0.46 vs 0.5), so a few frames may tip over. The burst must
    // still be mostly rejected. See NOTES.md #11.
    const inBurst = result.frameTimes
      .map((t, i) => (t >= 2.5 && t < 3.5 ? i : -1))
      .filter((i) => i >= 0);
    const meanScore = inBurst.reduce((sum, i) => sum + (result.frameScores[i] ?? 0), 0) / inBurst.length;
    const flagged = inBurst.filter((i) => result.frameDecisions[i]).length / inBurst.length;

    expect(meanScore).toBeLessThan(0.5);
    expect(flagged).toBeLessThan(0.3);
  });

  it("emits probabilities", () => {
    expect(Math.max(...result.frameScores)).toBeLessThanOrEqual(1);
    expect(Math.min(...result.frameScores)).toBeGreaterThanOrEqual(0);
  });
});

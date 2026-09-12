import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";
import { createEnergyVad, DEFAULT_ENERGY_CONFIG } from "./energy.js";

describe("energy VAD", () => {
  it("finds a single speech region on a quiet background", () => {
    const audio = synthesize({ durationSec: 3, speech: [{ start: 1, end: 2 }] });
    const { segments } = createEnergyVad().detect(audio, SAMPLE_RATE);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.start).toBeCloseTo(1, 1);
    // Hangover intentionally extends the end by up to hangoverFrames * hop.
    const hangoverSec = (DEFAULT_ENERGY_CONFIG.smoothing.hangoverFrames * DEFAULT_ENERGY_CONFIG.frame.hopMs) / 1000;
    expect(segments[0]?.end).toBeGreaterThanOrEqual(2);
    expect(segments[0]?.end).toBeLessThanOrEqual(2 + hangoverSec + 0.01);
  });

  it("separates two regions with a clear gap", () => {
    const audio = synthesize({
      durationSec: 4,
      speech: [
        { start: 0.5, end: 1.5 },
        { start: 2.5, end: 3.5 },
      ],
    });
    const { segments } = createEnergyVad().detect(audio, SAMPLE_RATE);
    expect(segments).toHaveLength(2);
  });

  it("adapts to a louder noise floor", () => {
    const audio = synthesize({
      durationSec: 3,
      speech: [{ start: 1, end: 2 }],
      noiseLevel: 0.03,
    });
    const { segments } = createEnergyVad().detect(audio, SAMPLE_RATE);
    expect(segments).toHaveLength(1);
  });

  it("returns nothing for digital silence", () => {
    const audio = new Float32Array(SAMPLE_RATE * 2);
    const { segments } = createEnergyVad().detect(audio, SAMPLE_RATE);
    expect(segments).toHaveLength(0);
  });
});

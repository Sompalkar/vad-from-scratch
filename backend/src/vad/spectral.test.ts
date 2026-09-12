import { describe, expect, it } from "vitest";
import { frameMetrics, segmentsToFrames } from "../eval/metrics.js";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";
import { createEnergyVad } from "./energy.js";
import { createSpectralVad } from "./spectral.js";

describe("spectral VAD", () => {
  it("finds a speech region on a quiet background", () => {
    const audio = synthesize({ durationSec: 3, speech: [{ start: 1, end: 2 }] });
    const { segments } = createSpectralVad().detect(audio, SAMPLE_RATE);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.start).toBeCloseTo(1, 1);
  });

  it("rejects a loud noise burst that energy VAD accepts", () => {
    const speech = [{ start: 0.5, end: 1.5 }];
    const audio = synthesize({
      durationSec: 4,
      speech,
      bursts: [{ start: 2.5, end: 3.5 }],
    });

    const energy = createEnergyVad().detect(audio, SAMPLE_RATE);
    const spectral = createSpectralVad().detect(audio, SAMPLE_RATE);
    const truth = segmentsToFrames(speech, energy.frameTimes);

    const energyF1 = frameMetrics(energy.frameDecisions, truth).f1;
    const spectralF1 = frameMetrics(spectral.frameDecisions, truth).f1;

    expect(energy.segments.length).toBe(2); // speech + burst
    expect(spectral.segments.length).toBe(1); // speech only
    expect(spectralF1).toBeGreaterThan(energyF1);
  });
});

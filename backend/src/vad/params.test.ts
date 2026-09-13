import { describe, expect, it } from "vitest";
import { createDetectorWithParams, sanitizeParams } from "./params.js";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";

describe("sanitizeParams", () => {
  it("drops unknown keys and clamps to range", () => {
    expect(sanitizeParams("energy", { marginDb: 999, hangoverFrames: -3, evil: 1, exitMarginDb: "abc" })).toEqual({
      marginDb: 30,
      hangoverFrames: 0,
    });
  });

  it("returns empty for garbage input", () => {
    expect(sanitizeParams("spectral", null)).toEqual({});
    expect(sanitizeParams("nope", { marginDb: 5 })).toEqual({});
  });
});

describe("createDetectorWithParams", () => {
  it("applies overrides", () => {
    const audio = synthesize({ durationSec: 3, speech: [{ start: 1, end: 2 }] });
    const loose = createDetectorWithParams("energy", { hangoverFrames: 20 }).detect(audio, SAMPLE_RATE);
    const tight = createDetectorWithParams("energy", { hangoverFrames: 0 }).detect(audio, SAMPLE_RATE);
    expect(loose.segments[0]?.end).toBeGreaterThan(tight.segments[0]?.end ?? 0);
  });
});

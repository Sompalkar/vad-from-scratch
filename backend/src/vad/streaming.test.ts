import { describe, expect, it } from "vitest";
import { gaussianNoise, roomNoise, SAMPLE_RATE, synthesize } from "../test/synth.js";
import { StreamingVad } from "./streaming.js";

function runInChunks(audio: Float32Array, chunkSize: number) {
  const vad = new StreamingVad(SAMPLE_RATE);
  const frames = [];
  for (let i = 0; i < audio.length; i += chunkSize) {
    frames.push(...vad.push(audio.subarray(i, i + chunkSize)));
  }
  return frames;
}

describe("StreamingVad", () => {
  const audio = synthesize({ durationSec: 4, speech: [{ start: 1.5, end: 2.5 }] });

  it("emits one frame per hop regardless of chunk size", () => {
    const small = runInChunks(audio, 100);
    const large = runInChunks(audio, 4096);
    expect(small.length).toBe(large.length);
    expect(small.map((f) => f.speech)).toEqual(large.map((f) => f.speech));
  });

  it("detects the speech region", () => {
    const frames = runInChunks(audio, 1024);
    const speechTimes = frames.filter((f) => f.speech).map((f) => f.time);
    expect(Math.min(...speechTimes)).toBeCloseTo(1.5, 1);
    expect(Math.max(...speechTimes)).toBeCloseTo(2.5, 1);
    // No false positives in the leading silence once the floor has settled
    expect(frames.filter((f) => f.time > 0.5 && f.time < 1.4).some((f) => f.speech)).toBe(false);
  });

  it("noise floor does not rise during speech", () => {
    const frames = runInChunks(audio, 1024);
    const before = frames.find((f) => f.time > 1.4)?.noiseFloorDb ?? 0;
    const during = frames.find((f) => f.time > 2.4)?.noiseFloorDb ?? 0;
    expect(during - before).toBeLessThan(3);
  });
});

describe("StreamingVad startup and clicks", () => {
  it("does not call a tonal room speech while the floor settles", () => {
    const normal = gaussianNoise(3);
    const audio = new Float32Array(SAMPLE_RATE * 5);
    for (let i = 0; i < audio.length; i++) audio[i] = 0.002 * normal() + 0.04 * roomNoise(i, normal);
    const frames = new StreamingVad(SAMPLE_RATE).push(audio);
    expect(frames.filter((f) => f.speech).length).toBe(0);
  });

  it("ignores a short click on a quiet room", () => {
    const normal = gaussianNoise(5);
    const audio = new Float32Array(SAMPLE_RATE * 2);
    for (let i = 0; i < audio.length; i++) audio[i] = 0.003 * normal();
    for (let i = 0; i < 160; i++) audio[SAMPLE_RATE + i] = 0.5 * normal(); // 10 ms click
    const frames = new StreamingVad(SAMPLE_RATE).push(audio);
    expect(frames.some((f) => f.speech)).toBe(false);
  });
});

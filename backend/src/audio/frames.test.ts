import { describe, expect, it } from "vitest";
import { frameSignal } from "./frames.js";

describe("frameSignal", () => {
  it("produces 30ms frames at 10ms hop", () => {
    const sampleRate = 16000;
    const samples = new Float32Array(sampleRate); // 1 second
    const { frames, times, frameLength, hopLength } = frameSignal(samples, sampleRate);

    expect(frameLength).toBe(480);
    expect(hopLength).toBe(160);
    // (16000 - 480) / 160 + 1 = 98 full frames
    expect(frames.length).toBe(98);
    expect(times[0]).toBe(0);
    expect(times[1]).toBeCloseTo(0.01);
  });

  it("frames are views, not copies", () => {
    const samples = new Float32Array(1000);
    const { frames } = frameSignal(samples, 1000, { frameMs: 100, hopMs: 50 });
    samples[0] = 0.75;
    expect(frames[0]?.[0]).toBe(0.75);
  });
});

import { describe, expect, it } from "vitest";
import { decodeWav, encodeWav } from "./wav.js";

function sine(freq: number, seconds: number, sampleRate: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

describe("wav round trip", () => {
  it("decodes what it encodes", () => {
    const original = sine(440, 0.1, 16000);
    const decoded = decodeWav(encodeWav({ samples: original, sampleRate: 16000 }));

    expect(decoded.sampleRate).toBe(16000);
    expect(decoded.samples.length).toBe(original.length);
    // 16-bit quantisation error is at most 1/32767
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs((decoded.samples[i] ?? 0) - (original[i] ?? 0))).toBeLessThan(1e-4);
    }
  });

  it("rejects non-WAV input", () => {
    expect(() => decodeWav(new ArrayBuffer(64))).toThrow(/RIFF/);
  });
});

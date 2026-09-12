import { describe, expect, it } from "vitest";
import { fft, magnitudeSpectrum, nextPowerOfTwo } from "./fft.js";

/** Reference O(n²) DFT to validate the FFT against. */
function dft(x: number[]): { re: number[]; im: number[] } {
  const n = x.length;
  const re = new Array<number>(n).fill(0);
  const im = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      re[k] = (re[k] ?? 0) + (x[t] ?? 0) * Math.cos(angle);
      im[k] = (im[k] ?? 0) + (x[t] ?? 0) * Math.sin(angle);
    }
  }
  return { re, im };
}

describe("fft", () => {
  it("matches a naive DFT", () => {
    const x = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1));
    const re = Float64Array.from(x);
    const im = new Float64Array(x.length);
    fft(re, im);
    const ref = dft(x);
    for (let k = 0; k < x.length; k++) {
      expect(re[k]).toBeCloseTo(ref.re[k] ?? 0, 9);
      expect(im[k]).toBeCloseTo(ref.im[k] ?? 0, 9);
    }
  });

  it("rejects non-power-of-two lengths", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });

  it("puts a pure tone in the right bin", () => {
    const sampleRate = 1024;
    const frame = new Float32Array(1024);
    for (let i = 0; i < frame.length; i++) frame[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
    const mag = magnitudeSpectrum(frame);
    const peak = mag.indexOf(Math.max(...mag));
    expect(peak).toBe(100); // bin k ↔ k * sampleRate / N = 100 Hz
  });
});

describe("nextPowerOfTwo", () => {
  it("rounds up", () => {
    expect(nextPowerOfTwo(480)).toBe(512);
    expect(nextPowerOfTwo(512)).toBe(512);
  });
});

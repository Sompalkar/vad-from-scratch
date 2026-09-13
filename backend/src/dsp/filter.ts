/**
 * Second-order Butterworth high-pass (biquad, RBJ cookbook form).
 *
 * Room rumble, mic handling noise and mains hum live below ~100 Hz and
 * look "tonal" to spectral features — exactly what voiced speech looks
 * like. Removing them before feature extraction is the first thing every
 * practical VAD does. Second order (12 dB/octave) because a first-order
 * filter barely dents a 60 Hz hum at a 100 Hz cutoff.
 */

export class HighPass {
  private readonly b0: number;
  private readonly b1: number;
  private readonly b2: number;
  private readonly a1: number;
  private readonly a2: number;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(sampleRate: number, cutoffHz: number) {
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
    const q = Math.SQRT1_2; // Butterworth: maximally flat passband
    const alpha = Math.sin(w0) / (2 * q);
    const cosW0 = Math.cos(w0);
    const a0 = 1 + alpha;
    this.b0 = (1 + cosW0) / 2 / a0;
    this.b1 = -(1 + cosW0) / a0;
    this.b2 = (1 + cosW0) / 2 / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  /** Filters in place and returns the same array. Keeps state across calls. */
  process(samples: Float32Array): Float32Array {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i] ?? 0;
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1;
      this.x1 = x;
      this.y2 = this.y1;
      this.y1 = y;
      samples[i] = y;
    }
    return samples;
  }
}

export const DEFAULT_HIGHPASS_HZ = 100;

/** Stateless convenience for whole-file use. Returns a filtered copy. */
export function highPass(samples: Float32Array, sampleRate: number, cutoffHz = DEFAULT_HIGHPASS_HZ): Float32Array {
  return new HighPass(sampleRate, cutoffHz).process(Float32Array.from(samples));
}

/**
 * Synthetic audio for tests: known "speech" regions on a known background.
 *
 * Real speech is a mix of harmonics; a few summed sines with slight jitter is
 * a fair stand-in for energy/spectral detectors. Noise is white Gaussian.
 */

export const SAMPLE_RATE = 16000;

export interface SynthRegion {
  start: number;
  end: number;
}

export interface SynthOptions {
  durationSec: number;
  speech: SynthRegion[];
  /** RMS amplitude of the speech-like tone. */
  speechLevel?: number;
  /** RMS amplitude of background noise. 0 = digital silence. */
  noiseLevel?: number;
  seed?: number;
}

export function synthesize(opts: SynthOptions): Float32Array {
  const { durationSec, speech, speechLevel = 0.3, noiseLevel = 0.005, seed = 1 } = opts;
  const rand = mulberry32(seed);
  const out = new Float32Array(Math.round(durationSec * SAMPLE_RATE));

  for (let i = 0; i < out.length; i++) {
    out[i] = noiseLevel * gaussian(rand);
  }

  // Voiced speech ≈ harmonic series on a ~120 Hz fundamental
  const harmonics = [120, 240, 360, 480, 600];
  for (const region of speech) {
    const a = Math.round(region.start * SAMPLE_RATE);
    const b = Math.min(out.length, Math.round(region.end * SAMPLE_RATE));
    for (let i = a; i < b; i++) {
      let s = 0;
      for (let h = 0; h < harmonics.length; h++) {
        const amp = 1 / (h + 1);
        s += amp * Math.sin((2 * Math.PI * (harmonics[h] ?? 0) * i) / SAMPLE_RATE);
      }
      out[i] = (out[i] ?? 0) + speechLevel * s * 0.5;
    }
  }
  return out;
}

/** Small deterministic PRNG so tests are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller: two uniforms → one standard normal. */
function gaussian(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

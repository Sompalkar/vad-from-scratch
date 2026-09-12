/**
 * Per-frame acoustic features.
 *
 * Everything here is a pure function of one frame. Detectors combine these
 * into decisions.
 */

/** Root-mean-square amplitude of a frame, in [0, 1]. */
export function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const s = frame[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / frame.length);
}

/**
 * Frame energy in decibels relative to full scale.
 * Silence is around -60 dB or lower; normal speech peaks near -20 dB.
 */
export function energyDb(frame: Float32Array): number {
  const EPS = 1e-10; // avoid log(0) on digital silence
  return 20 * Math.log10(rms(frame) + EPS);
}

/**
 * Fraction of adjacent sample pairs whose sign flips, in [0, 1].
 * Voiced speech is low-frequency so it crosses zero rarely; hiss and
 * fricatives ("s", "f") cross constantly. Cheap proxy for spectral content.
 */
export function zeroCrossingRate(frame: Float32Array): number {
  if (frame.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    const a = frame[i - 1] ?? 0;
    const b = frame[i] ?? 0;
    if ((a >= 0) !== (b >= 0)) crossings++;
  }
  return crossings / (frame.length - 1);
}

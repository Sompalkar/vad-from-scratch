/**
 * Downsample a signal for display. A 5-minute file is 4.8M samples; a
 * browser canvas is ~1000 px wide. For each pixel we keep the min and max so
 * the drawn waveform preserves peaks instead of aliasing them away.
 */

export interface WaveformPeaks {
  min: number[];
  max: number[];
  durationSec: number;
}

export function waveformPeaks(samples: Float32Array, sampleRate: number, points: number): WaveformPeaks {
  const bucket = Math.max(1, Math.ceil(samples.length / points));
  const min: number[] = [];
  const max: number[] = [];

  for (let start = 0; start < samples.length; start += bucket) {
    let lo = Infinity;
    let hi = -Infinity;
    const end = Math.min(samples.length, start + bucket);
    for (let i = start; i < end; i++) {
      const s = samples[i] ?? 0;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
    min.push(round(lo));
    max.push(round(hi));
  }
  return { min, max, durationSec: samples.length / sampleRate };
}

/** 3 decimals is plenty for pixels and keeps the JSON small. */
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

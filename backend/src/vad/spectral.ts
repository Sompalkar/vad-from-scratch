/**
 * Spectral VAD: energy gate + "does this sound like speech?" checks.
 *
 * Energy alone flags any loud noise. Each loud frame is also tested for:
 *  - low spectral flatness  → tonal/harmonic, not hiss
 *  - high speech-band ratio → most energy sits in 100–4000 Hz
 *
 * The checks are applied per *segment*, not per frame: fricatives ("s",
 * "f") are noise-like on their own, so a per-frame AND rule punches holes
 * in words. Instead, energy proposes segments and a segment survives if
 * enough of its frames look like speech. A noise burst fails nearly all of
 * its frames; a sentence fails only the fricatives.
 *
 * Thresholds were set from feature distributions on real speech, not by
 * hand: see NOTES.md #10 for the table.
 */

import { DEFAULT_FRAME_CONFIG, frameSignal, type FrameConfig } from "../audio/frames.js";
import { magnitudeSpectrum } from "../dsp/fft.js";
import { percentile } from "../dsp/stats.js";
import { bandEnergyRatio, energyDb, spectralFlatness } from "./features.js";
import { hysteresis, smooth, toSegments, type SmoothingConfig } from "./smoothing.js";
import { preprocess } from "./preprocess.js";
import type { VadDetector, VadResult } from "./types.js";

export interface SpectralVadConfig {
  frame: FrameConfig;
  smoothing: SmoothingConfig;
  noisePercentile: number;
  marginDb: number;
  exitMarginDb: number;
  floorDb: number;
  /** Frames flatter than this are treated as noise. */
  maxFlatness: number;
  /** Frames with less speech-band energy than this are treated as noise. */
  minBandRatio: number;
  /** A segment is kept if at least this fraction of its frames pass. */
  minSpeechLikeFraction: number;
  bandLowHz: number;
  bandHighHz: number;
}

export const DEFAULT_SPECTRAL_CONFIG: SpectralVadConfig = {
  frame: DEFAULT_FRAME_CONFIG,
  smoothing: { hangoverFrames: 4, minSpeechFrames: 5 },
  noisePercentile: 0.1,
  marginDb: 10,
  exitMarginDb: 5,
  floorDb: -55,
  maxFlatness: 0.6,
  minBandRatio: 0.65,
  minSpeechLikeFraction: 0.3,
  bandLowHz: 100,
  bandHighHz: 4000,
};

export function createSpectralVad(config: SpectralVadConfig = DEFAULT_SPECTRAL_CONFIG): VadDetector {
  return {
    name: "spectral",
    detect(input, sampleRate): VadResult {
      const samples = preprocess(input, sampleRate);
      const { frames, times, hopLength } = frameSignal(samples, sampleRate, config.frame);

      const energies = frames.map(energyDb);
      const noiseFloor = percentile(energies, config.noisePercentile);
      const threshold = Math.max(noiseFloor + config.marginDb, config.floorDb);

      const exitThreshold = Math.max(noiseFloor + config.exitMarginDb, config.floorDb);
      const loud = hysteresis(energies, threshold, exitThreshold);

      const speechLike = frames.map((frame, i) => {
        if (!loud[i]) return false;
        const spectrum = magnitudeSpectrum(frame);
        const flatness = spectralFlatness(spectrum);
        const band = bandEnergyRatio(spectrum, sampleRate, config.bandLowHz, config.bandHighHz);
        return flatness < config.maxFlatness && band > config.minBandRatio;
      });

      const raw = keepSpeechLikeRuns(loud, speechLike, config.minSpeechLikeFraction);
      const decisions = smooth(raw, config.smoothing);
      return {
        frameDecisions: decisions,
        frameScores: energies,
        frameTimes: times,
        segments: toSegments(decisions, times, hopLength / sampleRate),
        threshold,
      };
    },
  };
}

/** For each run of loud frames, keep it only if enough frames are speech-like. */
function keepSpeechLikeRuns(loud: boolean[], speechLike: boolean[], minFraction: number): boolean[] {
  const out = new Array<boolean>(loud.length).fill(false);
  let runStart = -1;
  for (let i = 0; i <= loud.length; i++) {
    const active = i < loud.length && loud[i];
    if (active && runStart < 0) {
      runStart = i;
    } else if (!active && runStart >= 0) {
      let passing = 0;
      for (let j = runStart; j < i; j++) if (speechLike[j]) passing++;
      if (passing / (i - runStart) >= minFraction) out.fill(true, runStart, i);
      runStart = -1;
    }
  }
  return out;
}

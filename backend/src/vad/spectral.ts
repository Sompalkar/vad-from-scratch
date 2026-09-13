/**
 * Spectral VAD: energy gate + "does this sound like speech?" checks.
 *
 * Energy alone flags any loud noise. On top of the energy gate we require:
 *  - low spectral flatness  → the frame is tonal/harmonic, not hiss
 *  - high speech-band ratio → most energy sits where speech lives
 *
 * A frame is speech only if all three agree.
 */

import { DEFAULT_FRAME_CONFIG, frameSignal, type FrameConfig } from "../audio/frames.js";
import { magnitudeSpectrum } from "../dsp/fft.js";
import { percentile } from "../dsp/stats.js";
import { bandEnergyRatio, energyDb, spectralFlatness } from "./features.js";
import { hysteresis, smooth, toSegments, type SmoothingConfig } from "./smoothing.js";
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
  maxFlatness: 0.5,
  minBandRatio: 0.6,
  bandLowHz: 300,
  bandHighHz: 3400,
};

export function createSpectralVad(config: SpectralVadConfig = DEFAULT_SPECTRAL_CONFIG): VadDetector {
  return {
    name: "spectral",
    detect(samples, sampleRate): VadResult {
      const { frames, times, hopLength } = frameSignal(samples, sampleRate, config.frame);

      const energies = frames.map(energyDb);
      const noiseFloor = percentile(energies, config.noisePercentile);
      const threshold = Math.max(noiseFloor + config.marginDb, config.floorDb);

      const exitThreshold = Math.max(noiseFloor + config.exitMarginDb, config.floorDb);
      const loud = hysteresis(energies, threshold, exitThreshold);

      const raw = frames.map((frame, i) => {
        if (!loud[i]) return false;
        const spectrum = magnitudeSpectrum(frame);
        const flatness = spectralFlatness(spectrum);
        const band = bandEnergyRatio(spectrum, sampleRate, config.bandLowHz, config.bandHighHz);
        return flatness < config.maxFlatness && band > config.minBandRatio;
      });

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

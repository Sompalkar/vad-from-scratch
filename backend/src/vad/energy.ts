/**
 * Energy-based VAD with an adaptive threshold.
 *
 * Assumption: speech is louder than the background. We estimate the
 * background ("noise floor") from the quietest frames, then call anything
 * sufficiently above it speech.
 */

import { DEFAULT_FRAME_CONFIG, frameSignal, type FrameConfig } from "../audio/frames.js";
import { percentile } from "../dsp/stats.js";
import { energyDb } from "./features.js";
import { smooth, toSegments, type SmoothingConfig } from "./smoothing.js";
import type { VadDetector, VadResult } from "./types.js";

export interface EnergyVadConfig {
  frame: FrameConfig;
  smoothing: SmoothingConfig;
  /** Which percentile of frame energies represents the noise floor. */
  noisePercentile: number;
  /** How many dB above the noise floor counts as speech. */
  marginDb: number;
  /** Never let the threshold go below this, so digital silence isn't "speech". */
  floorDb: number;
}

export const DEFAULT_ENERGY_CONFIG: EnergyVadConfig = {
  frame: DEFAULT_FRAME_CONFIG,
  smoothing: { hangoverFrames: 8, minSpeechFrames: 5 },
  noisePercentile: 0.1,
  marginDb: 12,
  floorDb: -55,
};

export function createEnergyVad(config: EnergyVadConfig = DEFAULT_ENERGY_CONFIG): VadDetector {
  return {
    name: "energy",
    detect(samples, sampleRate): VadResult {
      const { frames, times, hopLength } = frameSignal(samples, sampleRate, config.frame);
      const scores = frames.map(energyDb);

      const noiseFloor = percentile(scores, config.noisePercentile);
      const threshold = Math.max(noiseFloor + config.marginDb, config.floorDb);

      const raw = scores.map((db) => db > threshold);
      const decisions = smooth(raw, config.smoothing);

      return {
        frameDecisions: decisions,
        frameScores: scores,
        frameTimes: times,
        segments: toSegments(decisions, times, hopLength / sampleRate),
        threshold,
      };
    },
  };
}

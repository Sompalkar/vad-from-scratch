/**
 * Learned VAD: logistic regression over the hand-crafted frame features.
 *
 * Instead of hand-picking "flatness < 0.5 AND band > 0.6", the model learns
 * the cutoff and how to weigh each feature from labelled audio. Weights live
 * in model.json, produced by `npm run train`.
 */
import { predict, type LogisticModel } from "../ml/logistic.js";
import { extractFrameFeatures } from "./learned-features.js";
import { smooth, toSegments, type SmoothingConfig } from "./smoothing.js";
import type { VadDetector, VadResult } from "./types.js";
import model from "./model.json" with { type: "json" };

export interface LearnedVadConfig {
  smoothing: SmoothingConfig;
  /** Probability above which a frame is speech. */
  threshold: number;
}

export const DEFAULT_LEARNED_CONFIG: LearnedVadConfig = {
  smoothing: { hangoverFrames: 4, minSpeechFrames: 5 },
  threshold: 0.5,
};

export function createLearnedVad(
  config: LearnedVadConfig = DEFAULT_LEARNED_CONFIG,
  weights: LogisticModel = model,
): VadDetector {
  return {
    name: "learned",
    detect(samples, sampleRate): VadResult {
      const { features, times, hopSeconds } = extractFrameFeatures(samples, sampleRate);
      const probabilities = features.map((f) => predict(weights, f));
      const decisions = smooth(
        probabilities.map((p) => p > config.threshold),
        config.smoothing,
      );
      return {
        frameDecisions: decisions,
        frameScores: probabilities,
        frameTimes: times,
        segments: toSegments(decisions, times, hopSeconds),
        threshold: config.threshold,
      };
    },
  };
}

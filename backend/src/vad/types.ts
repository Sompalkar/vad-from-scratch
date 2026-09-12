import type { Segment } from "./smoothing.js";

export interface VadResult {
  /** One entry per frame: true if speech. */
  frameDecisions: boolean[];
  /** Per-frame score the decision was based on (dB, probability, etc.). */
  frameScores: number[];
  /** Start time of each frame in seconds. */
  frameTimes: number[];
  segments: Segment[];
  /** Threshold actually used, after adaptation. Useful for debugging/UI. */
  threshold: number;
}

export interface VadDetector {
  readonly name: string;
  detect(samples: Float32Array, sampleRate: number): VadResult;
}

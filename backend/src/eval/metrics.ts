/**
 * Frame-level evaluation of VAD output against ground-truth segments.
 *
 * Every frame is one of: true positive (speech, detected), false positive
 * (silence, detected), false negative (speech, missed), true negative.
 *
 *  precision = TP / (TP + FP)   "when we say speech, how often is it?"
 *  recall    = TP / (TP + FN)   "of the real speech, how much did we catch?"
 *  F1        = harmonic mean     single number balancing both
 */

import type { Segment } from "../vad/smoothing.js";

export interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  frames: number;
}

/** Mark each frame true if its start time falls inside any segment. */
export function segmentsToFrames(segments: Segment[], frameTimes: number[]): boolean[] {
  return frameTimes.map((t) => segments.some((s) => t >= s.start && t < s.end));
}

export function frameMetrics(predicted: boolean[], truth: boolean[]): Metrics {
  if (predicted.length !== truth.length) {
    throw new Error(`Length mismatch: ${predicted.length} predicted vs ${truth.length} truth`);
  }
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (let i = 0; i < truth.length; i++) {
    if (predicted[i] && truth[i]) tp++;
    else if (predicted[i] && !truth[i]) fp++;
    else if (!predicted[i] && truth[i]) fn++;
    else tn++;
  }
  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  return {
    precision,
    recall,
    f1: safeDiv(2 * precision * recall, precision + recall),
    accuracy: safeDiv(tp + tn, truth.length),
    frames: truth.length,
  };
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

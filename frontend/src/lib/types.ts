/** Shapes returned by the backend. Mirrors backend/src/api/server.ts. */

export interface Segment {
  start: number;
  end: number;
}

export interface WaveformPeaks {
  min: number[];
  max: number[];
  durationSec: number;
}

export interface VadResponse {
  method: string;
  sampleRate: number;
  durationSec: number;
  elapsedMs: number;
  segments: Segment[];
  threshold: number;
  frameTimes: number[];
  frameScores: number[];
  frameDecisions: boolean[];
  waveform: WaveformPeaks;
}

export interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  frames: number;
}

export interface SampleInfo {
  name: string;
  hasLabels: boolean;
}

export const DETECTORS = ["energy", "spectral"] as const;
export type DetectorName = (typeof DETECTORS)[number];

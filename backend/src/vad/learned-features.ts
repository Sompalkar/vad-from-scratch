/**
 * Feature vector for the learned detector. One function used by both the
 * trainer and the detector so the two can never drift apart.
 */
import { DEFAULT_FRAME_CONFIG, frameSignal } from "../audio/frames.js";
import { magnitudeSpectrum } from "../dsp/fft.js";
import { percentile } from "../dsp/stats.js";
import { bandEnergyRatio, energyDb, spectralFlatness, zeroCrossingRate } from "./features.js";
import { preprocess } from "./preprocess.js";

export const FEATURE_NAMES = ["energyAboveFloor", "flatness", "bandRatio", "zcr"] as const;

export interface FrameFeatures {
  features: number[][];
  times: number[];
  hopSeconds: number;
  noiseFloorDb: number;
  /** Raw per-frame dB, kept so detectors can apply an energy gate. */
  energiesDb: number[];
}

export function extractFrameFeatures(input: Float32Array, sampleRate: number): FrameFeatures {
  const samples = preprocess(input, sampleRate);
  const { frames, times, hopLength } = frameSignal(samples, sampleRate, DEFAULT_FRAME_CONFIG);
  const energies = frames.map(energyDb);
  // Energy is expressed relative to this file's noise floor so the model
  // generalises across recordings with different gain.
  const noiseFloorDb = percentile(energies, 0.1);

  const features = frames.map((frame, i) => {
    const spectrum = magnitudeSpectrum(frame);
    return [
      (energies[i] ?? noiseFloorDb) - noiseFloorDb,
      spectralFlatness(spectrum),
      bandEnergyRatio(spectrum, sampleRate, 100, 4000),
      zeroCrossingRate(frame),
    ];
  });

  return { features, times, hopSeconds: hopLength / sampleRate, noiseFloorDb, energiesDb: energies };
}

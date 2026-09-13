import { createEnergyVad } from "./energy.js";
import { createLearnedVad } from "./learned.js";
import { createSpectralVad } from "./spectral.js";
import type { VadDetector } from "./types.js";

export const DETECTORS: Record<string, () => VadDetector> = {
  energy: createEnergyVad,
  spectral: createSpectralVad,
  learned: createLearnedVad,
};

export type DetectorName = keyof typeof DETECTORS;

export function isDetectorName(value: string): value is DetectorName {
  return Object.hasOwn(DETECTORS, value);
}

export function createDetector(name: DetectorName): VadDetector {
  const factory = DETECTORS[name];
  if (!factory) throw new Error(`Unknown detector: ${name}`);
  return factory();
}

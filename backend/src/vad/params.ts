/**
 * User-tunable detector parameters. An explicit allowlist with ranges, so
 * the API can accept overrides without exposing every config field.
 */
import { createEnergyVad, DEFAULT_ENERGY_CONFIG } from "./energy.js";
import { createLearnedVad, DEFAULT_LEARNED_CONFIG } from "./learned.js";
import { createSpectralVad, DEFAULT_SPECTRAL_CONFIG } from "./spectral.js";
import type { VadDetector } from "./types.js";

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

const SMOOTHING: ParamSpec[] = [
  { key: "hangoverFrames", label: "Hangover (frames)", min: 0, max: 20, step: 1, default: 4 },
  { key: "minSpeechFrames", label: "Min speech (frames)", min: 1, max: 30, step: 1, default: 5 },
];

export const PARAM_SPECS: Record<string, ParamSpec[]> = {
  energy: [
    { key: "marginDb", label: "Enter margin (dB)", min: 0, max: 30, step: 1, default: 12 },
    { key: "exitMarginDb", label: "Exit margin (dB)", min: 0, max: 30, step: 1, default: 6 },
    ...SMOOTHING,
  ],
  spectral: [
    { key: "marginDb", label: "Enter margin (dB)", min: 0, max: 30, step: 1, default: 10 },
    { key: "exitMarginDb", label: "Exit margin (dB)", min: 0, max: 30, step: 1, default: 5 },
    { key: "maxFlatness", label: "Max flatness", min: 0.05, max: 1, step: 0.05, default: 0.6 },
    { key: "minBandRatio", label: "Min band ratio", min: 0, max: 1, step: 0.05, default: 0.65 },
    { key: "minSpeechLikeFraction", label: "Min speech-like fraction", min: 0, max: 1, step: 0.05, default: 0.3 },
    ...SMOOTHING,
  ],
  learned: [
    { key: "threshold", label: "Probability threshold", min: 0.05, max: 0.95, step: 0.05, default: 0.5 },
    { key: "marginDb", label: "Enter margin (dB)", min: 0, max: 30, step: 1, default: 8 },
    { key: "exitMarginDb", label: "Exit margin (dB)", min: 0, max: 30, step: 1, default: 4 },
    { key: "smoothingWindow", label: "Smoothing window (frames)", min: 1, max: 21, step: 2, default: 7 },
    ...SMOOTHING,
  ],
};

export type Params = Record<string, number>;

/** Keeps only known keys, clamped to their declared range. */
export function sanitizeParams(detector: string, raw: unknown): Params {
  const specs = PARAM_SPECS[detector] ?? [];
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Params = {};
  for (const spec of specs) {
    const value = Number(input[spec.key]);
    if (Number.isFinite(value)) out[spec.key] = Math.min(spec.max, Math.max(spec.min, value));
  }
  return out;
}

export function createDetectorWithParams(detector: string, params: Params): VadDetector {
  const { hangoverFrames, minSpeechFrames, ...rest } = params;
  const smoothing = (defaults: { hangoverFrames: number; minSpeechFrames: number }) => ({
    hangoverFrames: hangoverFrames ?? defaults.hangoverFrames,
    minSpeechFrames: minSpeechFrames ?? defaults.minSpeechFrames,
  });

  switch (detector) {
    case "energy":
      return createEnergyVad({ ...DEFAULT_ENERGY_CONFIG, ...rest, smoothing: smoothing(DEFAULT_ENERGY_CONFIG.smoothing) });
    case "spectral":
      return createSpectralVad({
        ...DEFAULT_SPECTRAL_CONFIG,
        ...rest,
        smoothing: smoothing(DEFAULT_SPECTRAL_CONFIG.smoothing),
      });
    case "learned":
      return createLearnedVad({ ...DEFAULT_LEARNED_CONFIG, ...rest, smoothing: smoothing(DEFAULT_LEARNED_CONFIG.smoothing) });
    default:
      throw new Error(`Unknown detector: ${detector}`);
  }
}

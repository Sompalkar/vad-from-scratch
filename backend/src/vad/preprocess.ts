import { highPass } from "../dsp/filter.js";

/** Shared front end for every offline detector: remove sub-100 Hz rumble. */
export function preprocess(samples: Float32Array, sampleRate: number): Float32Array {
  return highPass(samples, sampleRate);
}

/**
 * Generate labelled sample WAVs into ../samples/.
 * Each sample has a sibling .json with ground-truth speech segments.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeWav } from "../src/audio/wav.js";
import { SAMPLE_RATE, synthesize, type SynthOptions } from "../src/test/synth.js";

const OUT = join(import.meta.dirname, "..", "..", "samples");

const samples: Record<string, SynthOptions> = {
  "clean-single": { durationSec: 3, speech: [{ start: 1, end: 2 }] },
  "clean-multi": {
    durationSec: 6,
    speech: [
      { start: 0.5, end: 1.4 },
      { start: 2.0, end: 3.5 },
      { start: 4.2, end: 5.1 },
    ],
  },
  "noisy-background": {
    durationSec: 5,
    speech: [
      { start: 1, end: 2 },
      { start: 3, end: 4.2 },
    ],
    noiseLevel: 0.04,
  },
  "with-noise-bursts": {
    durationSec: 6,
    speech: [
      { start: 0.5, end: 1.5 },
      { start: 4, end: 5 },
    ],
    bursts: [{ start: 2.5, end: 3.2 }],
  },
  "room-noise": {
    durationSec: 6,
    speech: [
      { start: 1, end: 2.2 },
      { start: 3.5, end: 5 },
    ],
    noiseLevel: 0.003,
    roomLevel: 0.02,
    bursts: [{ start: 2.6, end: 3.1 }],
  },
  "quiet-speech": {
    durationSec: 4,
    speech: [{ start: 1, end: 3 }],
    speechLevel: 0.05,
    noiseLevel: 0.008,
  },
  "many-bursts": {
    durationSec: 8,
    speech: [
      { start: 1, end: 2 },
      { start: 5, end: 6.5 },
    ],
    noiseLevel: 0.005,
    bursts: [
      { start: 0.2, end: 0.5 },
      { start: 2.8, end: 3.4 },
      { start: 3.9, end: 4.2 },
      { start: 7, end: 7.6 },
    ],
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, opts] of Object.entries(samples)) {
  const audio = synthesize(opts);
  writeFileSync(join(OUT, `${name}.wav`), Buffer.from(encodeWav({ samples: audio, sampleRate: SAMPLE_RATE })));
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ speech: opts.speech }, null, 2));
  console.log(`wrote ${name}.wav (${opts.durationSec}s)`);
}

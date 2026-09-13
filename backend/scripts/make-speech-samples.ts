/**
 * Builds labelled samples from real synthesised speech (macOS `say`).
 *
 * Each phrase is rendered to WAV, trimmed to its voiced extent, then placed
 * into a longer file with known gaps, background noise, and noise bursts.
 * Because we control the placement, labels are exact.
 *
 * Requires macOS (`say`, `afconvert`). Output goes to ../samples/speech-*.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeWav, encodeWav } from "../src/audio/wav.js";
import { rms } from "../src/vad/features.js";
import { gaussianNoise, roomNoise } from "../src/test/synth.js";

const SAMPLE_RATE = 16000;
const OUT = join(import.meta.dirname, "..", "..", "samples");

const PHRASES = [
  "Hello, can you hear me?",
  "The quick brown fox jumps over the lazy dog.",
  "Six fish swam past the shore.",
  "Please switch off the fan before you leave.",
  "I think we should start the meeting now.",
  "Seventy seven, eighty eight, ninety nine.",
];
const VOICES = ["Samantha", "Daniel", "Karen"];

interface Layout {
  name: string;
  /** [voice, phrase index] pairs in order. */
  utterances: [string, number][];
  gapSec: number;
  noiseLevel: number;
  roomLevel?: number;
  /** Peak amplitude speech is normalised to. Default ≈ -6 dBFS, a normal mic level. */
  speechPeak?: number;
  bursts?: { at: number; sec: number; level: number }[];
}

const LAYOUTS: Layout[] = [
  { name: "speech-clean", utterances: [["Samantha", 0], ["Samantha", 1], ["Samantha", 2]], gapSec: 1.2, noiseLevel: 0.002 },
  { name: "speech-two-voices", utterances: [["Daniel", 3], ["Karen", 4], ["Daniel", 5]], gapSec: 0.8, noiseLevel: 0.004 },
  { name: "speech-noisy", utterances: [["Karen", 1], ["Karen", 3]], gapSec: 1.5, noiseLevel: 0.03 },
  {
    name: "speech-with-bursts",
    utterances: [["Daniel", 0], ["Samantha", 4]],
    gapSec: 2,
    noiseLevel: 0.005,
    bursts: [
      { at: 1, sec: 0.4, level: 0.25 },
      { at: 8.6, sec: 0.5, level: 0.15 },
    ],
  },
  {
    name: "speech-room-noise",
    utterances: [["Karen", 0], ["Samantha", 5], ["Daniel", 2]],
    gapSec: 1.5,
    noiseLevel: 0.003,
    roomLevel: 0.02,
    bursts: [{ at: 0.4, sec: 0.5, level: 0.2 }],
  },
  { name: "speech-quiet", utterances: [["Samantha", 2], ["Daniel", 1]], gapSec: 1, noiseLevel: 0.004, speechPeak: 0.08 },
];

function renderPhrase(voice: string, text: string, dir: string): Float32Array {
  const aiff = join(dir, "phrase.aiff");
  const wav = join(dir, "phrase.wav");
  execFileSync("say", ["-v", voice, "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${SAMPLE_RATE}`, "-c", "1", aiff, wav]);
  return trim(decodeWav(readFileSync(wav)).samples);
}

/** Cut leading/trailing near-silence so the label boundaries are tight. */
function trim(samples: Float32Array, thresholdDb = -45): Float32Array {
  const win = Math.round(SAMPLE_RATE * 0.01);
  const threshold = 10 ** (thresholdDb / 20);
  let start = 0;
  let end = samples.length;
  while (start + win < samples.length && rms(samples.subarray(start, start + win)) < threshold) start += win;
  while (end - win > start && rms(samples.subarray(end - win, end)) < threshold) end -= win;
  return samples.subarray(start, end);
}

function build(layout: Layout, dir: string): { audio: Float32Array; speech: { start: number; end: number }[] } {
  const clips = layout.utterances.map(([voice, i]) => renderPhrase(voice, PHRASES[i] ?? "", dir));
  const gap = Math.round(layout.gapSec * SAMPLE_RATE);
  const total = gap + clips.reduce((n, c) => n + c.length + gap, 0);

  const rand = gaussianNoise(7);
  const audio = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    audio[i] = layout.noiseLevel * rand() + (layout.roomLevel ?? 0) * roomNoise(i, rand);
  }

  const speech: { start: number; end: number }[] = [];
  let cursor = gap;
  for (const clip of clips) {
    const peak = Math.max(...Array.from(clip, Math.abs));
    const gain = (layout.speechPeak ?? 0.5) / peak;
    for (let i = 0; i < clip.length; i++) audio[cursor + i] = (audio[cursor + i] ?? 0) + (clip[i] ?? 0) * gain;
    speech.push({ start: cursor / SAMPLE_RATE, end: (cursor + clip.length) / SAMPLE_RATE });
    cursor += clip.length + gap;
  }

  for (const burst of layout.bursts ?? []) {
    const a = Math.round(burst.at * SAMPLE_RATE);
    const b = Math.min(total, a + Math.round(burst.sec * SAMPLE_RATE));
    for (let i = a; i < b; i++) audio[i] = (audio[i] ?? 0) + burst.level * rand();
  }

  return { audio, speech };
}

const dir = mkdtempSync(join(tmpdir(), "vad-say-"));
mkdirSync(OUT, { recursive: true });
try {
  for (const layout of LAYOUTS) {
    const { audio, speech } = build(layout, dir);
    writeFileSync(join(OUT, `${layout.name}.wav`), Buffer.from(encodeWav({ samples: audio, sampleRate: SAMPLE_RATE })));
    writeFileSync(join(OUT, `${layout.name}.json`), JSON.stringify({ speech }, null, 2));
    console.log(`wrote ${layout.name}.wav (${(audio.length / SAMPLE_RATE).toFixed(1)}s, ${speech.length} utterances)`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Runs every detector over every labelled sample and reports frame-level F1.
 * Shared by the CLI and (later) the API.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { decodeWav } from "../audio/wav.js";
import { createDetector, DETECTORS, type DetectorName } from "../vad/index.js";
import type { Segment } from "../vad/smoothing.js";
import { frameMetrics, segmentsToFrames, type Metrics } from "./metrics.js";

export interface LabelledSample {
  name: string;
  samples: Float32Array;
  sampleRate: number;
  truth: Segment[];
}

export interface EvalRow {
  sample: string;
  detector: DetectorName;
  metrics: Metrics;
  elapsedMs: number;
}

export async function loadLabelledSamples(dir: string): Promise<LabelledSample[]> {
  const files = await readdir(dir);
  const out: LabelledSample[] = [];
  for (const file of files.filter((f) => f.endsWith(".wav"))) {
    const name = basename(file, ".wav");
    const labelFile = `${name}.json`;
    if (!files.includes(labelFile)) continue;
    const audio = decodeWav(await readFile(join(dir, file)));
    const truth = (JSON.parse(await readFile(join(dir, labelFile), "utf8")) as { speech: Segment[] }).speech;
    out.push({ name, ...audio, truth });
  }
  return out;
}

export function evaluateAll(samples: LabelledSample[]): EvalRow[] {
  const rows: EvalRow[] = [];
  for (const sample of samples) {
    for (const detector of Object.keys(DETECTORS) as DetectorName[]) {
      const started = performance.now();
      const result = createDetector(detector).detect(sample.samples, sample.sampleRate);
      const elapsedMs = performance.now() - started;
      const truth = segmentsToFrames(sample.truth, result.frameTimes);
      rows.push({ sample: sample.name, detector, metrics: frameMetrics(result.frameDecisions, truth), elapsedMs });
    }
  }
  return rows;
}

/** Mean F1 per detector across all samples. */
export function summarize(rows: EvalRow[]): Record<string, number> {
  const sums: Record<string, { f1: number; n: number }> = {};
  for (const row of rows) {
    const entry = (sums[row.detector] ??= { f1: 0, n: 0 });
    entry.f1 += row.metrics.f1;
    entry.n++;
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v.f1 / v.n]));
}

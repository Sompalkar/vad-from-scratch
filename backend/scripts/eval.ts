/** Prints a markdown table of detector accuracy over the labelled samples. */
import { join } from "node:path";
import { evaluateAll, loadLabelledSamples, summarize } from "../src/eval/runner.js";
import { DETECTORS } from "../src/vad/index.js";

const samples = await loadLabelledSamples(join(import.meta.dirname, "..", "..", "samples"));
const rows = evaluateAll(samples);
const detectors = Object.keys(DETECTORS);

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

console.log(`| sample | ${detectors.map((d) => `${d} F1`).join(" | ")} |`);
console.log(`|---|${detectors.map(() => "---").join("|")}|`);
for (const sample of samples) {
  const cells = detectors.map((d) => {
    const row = rows.find((r) => r.sample === sample.name && r.detector === d);
    return row ? pct(row.metrics.f1) : "—";
  });
  console.log(`| ${sample.name} | ${cells.join(" | ")} |`);
}

const mean = summarize(rows);
console.log(`| **mean** | ${detectors.map((d) => `**${pct(mean[d] ?? 0)}**`).join(" | ")} |`);

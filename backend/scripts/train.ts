/**
 * Trains the learned detector on every labelled sample and writes
 * src/vad/model.json. Prints loss and the learned weights.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLabelledSamples, type LabelledSample } from "../src/eval/runner.js";
import { frameMetrics, segmentsToFrames } from "../src/eval/metrics.js";
import { train } from "../src/ml/logistic.js";
import { extractFrameFeatures, FEATURE_NAMES } from "../src/vad/learned-features.js";
import { createLearnedVad } from "../src/vad/learned.js";

const root = join(import.meta.dirname, "..");
const samples = await loadLabelledSamples(join(root, "..", "samples"));

function dataset(files: LabelledSample[]): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (const sample of files) {
    const { features, times } = extractFrameFeatures(sample.samples, sample.sampleRate);
    const labels = segmentsToFrames(sample.truth, times);
    X.push(...features);
    y.push(...labels.map((l) => (l ? 1 : 0)));
  }
  return { X, y };
}

// Leave-one-file-out: the honest accuracy estimate, since evaluating on the
// training files would only show the model memorised them.
console.log("leave-one-out F1:");
let cvSum = 0;
for (const held of samples) {
  const { X, y } = dataset(samples.filter((s) => s !== held));
  const { model } = train(X, y);
  const result = createLearnedVad(undefined, model).detect(held.samples, held.sampleRate);
  const f1 = frameMetrics(result.frameDecisions, segmentsToFrames(held.truth, result.frameTimes)).f1;
  cvSum += f1;
  console.log(`  ${held.name.padEnd(20)} ${(f1 * 100).toFixed(1)}%`);
}
console.log(`  ${"mean".padEnd(20)} ${((cvSum / samples.length) * 100).toFixed(1)}%\n`);

const { X, y } = dataset(samples);
const { model, loss } = train(X, y);

console.log(`trained on ${X.length} frames from ${samples.length} files`);
console.log(`loss: ${loss[0]?.toFixed(3)} → ${loss.at(-1)?.toFixed(3)}`);
for (let j = 0; j < FEATURE_NAMES.length; j++) {
  console.log(`  ${FEATURE_NAMES[j]?.padEnd(18)} ${model.weights[j]?.toFixed(3)}`);
}
console.log(`  bias               ${model.bias.toFixed(3)}`);

writeFileSync(join(root, "src", "vad", "model.json"), JSON.stringify(model, null, 2) + "\n");

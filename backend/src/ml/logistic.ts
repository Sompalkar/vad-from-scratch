/**
 * Logistic regression trained by batch gradient descent.
 *
 *   p(y = 1 | x) = sigmoid(w · x + b)
 *
 * Features are standardised (zero mean, unit variance) before training and
 * the same statistics are stored with the model, so inference sees the same
 * scale it was trained on.
 */

export interface LogisticModel {
  weights: number[];
  bias: number;
  /** Per-feature mean/std used to standardise inputs. */
  mean: number[];
  std: number[];
}

export interface TrainOptions {
  learningRate: number;
  epochs: number;
  /** L2 penalty — keeps weights small so no single feature dominates. */
  l2: number;
}

export const DEFAULT_TRAIN_OPTIONS: TrainOptions = { learningRate: 0.1, epochs: 500, l2: 1e-3 };

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function predict(model: LogisticModel, features: number[]): number {
  let z = model.bias;
  for (let j = 0; j < features.length; j++) {
    const x = ((features[j] ?? 0) - (model.mean[j] ?? 0)) / (model.std[j] ?? 1);
    z += (model.weights[j] ?? 0) * x;
  }
  return sigmoid(z);
}

export function train(
  X: number[][],
  y: number[],
  options: TrainOptions = DEFAULT_TRAIN_OPTIONS,
): { model: LogisticModel; loss: number[] } {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  if (n === 0 || d === 0) throw new Error("Need at least one sample with one feature");

  const { mean, std } = featureStats(X);
  const Xs = X.map((row) => row.map((v, j) => (v - (mean[j] ?? 0)) / (std[j] ?? 1)));

  const weights = new Array<number>(d).fill(0);
  let bias = 0;
  const loss: number[] = [];

  for (let epoch = 0; epoch < options.epochs; epoch++) {
    const gradW = new Array<number>(d).fill(0);
    let gradB = 0;
    let epochLoss = 0;

    for (let i = 0; i < n; i++) {
      const row = Xs[i] ?? [];
      const target = y[i] ?? 0;
      let z = bias;
      for (let j = 0; j < d; j++) z += (weights[j] ?? 0) * (row[j] ?? 0);
      const p = sigmoid(z);

      // Log-loss and its gradient. d(loss)/dz = p - y is the whole trick.
      const EPS = 1e-12;
      epochLoss -= target * Math.log(p + EPS) + (1 - target) * Math.log(1 - p + EPS);
      const err = p - target;
      for (let j = 0; j < d; j++) gradW[j] = (gradW[j] ?? 0) + err * (row[j] ?? 0);
      gradB += err;
    }

    for (let j = 0; j < d; j++) {
      const w = weights[j] ?? 0;
      weights[j] = w - options.learningRate * ((gradW[j] ?? 0) / n + options.l2 * w);
    }
    bias -= options.learningRate * (gradB / n);
    loss.push(epochLoss / n);
  }

  return { model: { weights, bias, mean, std }, loss };
}

function featureStats(X: number[][]): { mean: number[]; std: number[] } {
  const d = X[0]?.length ?? 0;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] = (mean[j] ?? 0) + (row[j] ?? 0);
  for (let j = 0; j < d; j++) mean[j] = (mean[j] ?? 0) / X.length;
  for (const row of X) {
    for (let j = 0; j < d; j++) std[j] = (std[j] ?? 0) + ((row[j] ?? 0) - (mean[j] ?? 0)) ** 2;
  }
  for (let j = 0; j < d; j++) std[j] = Math.sqrt((std[j] ?? 0) / X.length) || 1;
  return { mean, std };
}

/** Value at the p-th quantile (0..1) of an unsorted list. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

/** Centred moving average with a window of `size` (odd), edges shrink. */
export function movingAverage(values: number[], size: number): number[] {
  const half = Math.floor(size / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j] ?? 0;
    return sum / (to - from);
  });
}

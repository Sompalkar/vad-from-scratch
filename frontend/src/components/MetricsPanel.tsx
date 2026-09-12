import type { Metrics } from "@/lib/types";

interface Props {
  metrics: Metrics;
}

const ROWS: { key: keyof Metrics; label: string; hint: string }[] = [
  { key: "precision", label: "Precision", hint: "of frames called speech, how many were" },
  { key: "recall", label: "Recall", hint: "of real speech frames, how many we caught" },
  { key: "f1", label: "F1", hint: "harmonic mean of the two" },
  { key: "accuracy", label: "Accuracy", hint: "all frames classified correctly" },
];

export function MetricsPanel({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ROWS.map(({ key, label, hint }) => (
        <div key={key} className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
          <div className="mt-1 font-mono text-2xl text-emerald-300">{(metrics[key] * 100).toFixed(1)}%</div>
          <div className="mt-1 text-xs text-zinc-500">{hint}</div>
        </div>
      ))}
    </div>
  );
}

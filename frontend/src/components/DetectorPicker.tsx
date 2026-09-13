"use client";

import { DETECTORS, type DetectorName } from "@/lib/types";

const DESCRIPTIONS: Record<DetectorName, string> = {
  energy: "Loudness above an adaptive noise floor. Simple, fast, fooled by any loud sound.",
  spectral: "Energy gate plus two checks that the loud part is voice-shaped. Rejects bursts and clicks.",
  learned: "Logistic regression over the same features, trained on labelled audio. Trained here, from scratch.",
};

interface Props {
  value: DetectorName;
  disabled: boolean;
  onChange: (d: DetectorName) => void;
}

export function DetectorPicker({ value, disabled, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex overflow-hidden rounded-md border border-zinc-700">
        {DETECTORS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onChange(d)}
            className={`flex-1 px-4 py-2 capitalize transition-colors ${
              d === value ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">{DESCRIPTIONS[value]}</p>
    </div>
  );
}

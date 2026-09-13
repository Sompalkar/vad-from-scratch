"use client";

import type { SampleInfo } from "@/lib/types";

interface Props {
  samples: SampleInfo[];
  selected: string;
  disabled: boolean;
  onSample: (name: string) => void;
  onUpload: (file: File) => void;
}

export function SourcePicker({ samples, selected, disabled, onSample, onUpload }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-400">Sample</span>
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 disabled:opacity-50"
          value={selected}
          disabled={disabled}
          onChange={(e) => onSample(e.target.value)}
        >
          <option value="">— choose —</option>
          {samples.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.hasLabels ? "  ·  labelled" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex cursor-pointer flex-col gap-1 text-sm">
        <span className="text-zinc-400">or your own WAV</span>
        <span className="rounded-md border border-dashed border-zinc-700 px-3 py-2 text-zinc-300 hover:border-zinc-500">
          Upload…
          <input
            type="file"
            accept=".wav,audio/wav"
            disabled={disabled}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </span>
      </label>
    </div>
  );
}

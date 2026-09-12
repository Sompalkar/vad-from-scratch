"use client";

import { DETECTORS, type DetectorName, type SampleInfo } from "@/lib/types";

interface Props {
  samples: SampleInfo[];
  selectedSample: string;
  method: DetectorName;
  busy: boolean;
  onSample: (name: string) => void;
  onUpload: (file: File) => void;
  onMethod: (m: DetectorName) => void;
}

export function Controls({ samples, selectedSample, method, busy, onSample, onUpload, onMethod }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Sample</span>
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          value={selectedSample}
          disabled={busy}
          onChange={(e) => onSample(e.target.value)}
        >
          <option value="">— choose —</option>
          {samples.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.hasLabels ? " (labelled)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">or upload WAV</span>
        <input
          type="file"
          accept=".wav,audio/wav"
          disabled={busy}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Detector</span>
        <div className="flex overflow-hidden rounded-md border border-zinc-700">
          {DETECTORS.map((d) => (
            <button
              key={d}
              type="button"
              disabled={busy}
              onClick={() => onMethod(d)}
              className={`px-4 py-2 capitalize ${
                d === method ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

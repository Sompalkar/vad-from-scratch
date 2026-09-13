"use client";

import type { Params, ParamSpec } from "@/lib/types";

interface Props {
  specs: ParamSpec[];
  values: Params;
  disabled: boolean;
  /** Fires continuously while dragging. */
  onChange: (next: Params) => void;
  /** Fires once when the user lets go — the moment to re-run detection. */
  onCommit: (next: Params) => void;
  onReset: () => void;
}

export function ParamSliders({ specs, values, disabled, onChange, onCommit, onReset }: Props) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-zinc-400">Parameters</span>
        <button type="button" onClick={onReset} className="text-xs text-zinc-500 hover:text-zinc-300">
          reset
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {specs.map((spec) => {
          const value = values[spec.key] ?? spec.default;
          return (
            <label key={spec.key} className="flex flex-col gap-1 text-xs">
              <span className="flex justify-between text-zinc-400">
                {spec.label}
                <span className="font-mono text-zinc-200">{value}</span>
              </span>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={value}
                disabled={disabled}
                className="accent-emerald-400"
                onChange={(e) => onChange({ ...values, [spec.key]: Number(e.target.value) })}
                onPointerUp={() => onCommit(values)}
                onKeyUp={() => onCommit(values)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

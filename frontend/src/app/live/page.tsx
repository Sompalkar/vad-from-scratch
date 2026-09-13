"use client";

import Link from "next/link";
import { LiveMeter } from "@/components/LiveMeter";
import { useMicStream } from "@/hooks/useMicStream";

const HISTORY = 600;

export default function Live() {
  const { frames, active, error, start, stop } = useMicStream();
  const latest = frames.at(-1);
  const speaking = latest?.speech ?? false;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live VAD</h1>
          <p className="mt-1 text-sm text-zinc-400">Microphone → WebSocket → streaming detector, ~10 ms per decision.</p>
        </div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← file mode
        </Link>
      </header>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={active ? stop : start}
          className={`rounded-md px-4 py-2 font-medium ${
            active ? "bg-rose-500 text-zinc-950" : "bg-emerald-500 text-zinc-950"
          }`}
        >
          {active ? "Stop" : "Start microphone"}
        </button>
        {active && (
          <div
            className={`rounded-md px-4 py-2 font-mono text-lg transition-colors ${
              speaking ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {speaking ? "SPEECH" : "silence"}
          </div>
        )}
      </div>

      {error && <div className="rounded-md border border-rose-900 bg-rose-950 p-3 text-sm text-rose-200">{error}</div>}

      <section className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-zinc-400">
          <span>Speech probability (last 6 s)</span>
          {latest && (
            <span className="font-mono">
              p={latest.score.toFixed(2)} · floor {latest.noiseFloorDb.toFixed(1)} dB
            </span>
          )}
        </div>
        <LiveMeter frames={frames} capacity={HISTORY} />
      </section>
    </main>
  );
}

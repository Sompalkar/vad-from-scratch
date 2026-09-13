"use client";

import { LevelBar, LiveMeter } from "@/components/LiveMeter";
import { useMicStream } from "@/hooks/useMicStream";

const HISTORY = 600; // 6 s at 100 frames/s
const THRESHOLD = 0.5;
const GATE_DB = 8;

export default function Live() {
  const { frames, active, connecting, error, start, stop } = useMicStream();
  const latest = frames.at(-1);
  const speaking = latest?.speech ?? false;
  const speechSeconds = frames.filter((f) => f.speech).length / 100;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Live microphone</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Your mic → 16 kHz PCM → WebSocket → the streaming detector, one decision every 10 ms. Nothing is recorded or
          stored.
        </p>
      </header>

      <section className="grid gap-5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={active ? stop : start}
            disabled={connecting}
            className={`rounded-md px-5 py-2.5 font-medium transition-colors disabled:opacity-60 ${
              active ? "bg-rose-500 text-zinc-950 hover:bg-rose-400" : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            }`}
          >
            {connecting ? "Connecting…" : active ? "Stop" : "Start microphone"}
          </button>
          <div
            className={`flex h-16 items-center justify-center rounded-md font-mono text-2xl tracking-wide transition-colors ${
              !active
                ? "bg-zinc-900 text-zinc-700"
                : speaking
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {!active ? "off" : speaking ? "SPEECH" : "silence"}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          <LevelBar
            levelDb={latest?.energyDb ?? null}
            floorDb={latest?.noiseFloorDb ?? null}
            marginDb={GATE_DB}
          />
          <p className="text-xs text-zinc-500">
            The floor is the quietest 10 % of the last 3 s — it settles in about a second. A frame must clear the gate{" "}
            <em>and</em> score above {THRESHOLD} on the model to count. Try: talk, stop, snap your fingers, hum.
          </p>
        </div>
      </section>

      {error && <div className="rounded-md border border-rose-900 bg-rose-950 p-3 text-sm text-rose-200">{error}</div>}

      <section className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-zinc-400">
          <span>Speech probability, last 6 s</span>
          {latest && (
            <span className="font-mono text-xs">
              p={latest.score.toFixed(2)} · speech {speechSeconds.toFixed(1)} s / 6 s
            </span>
          )}
        </div>
        <LiveMeter frames={frames} capacity={HISTORY} threshold={THRESHOLD} />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
        <h2 className="mb-2 font-medium text-zinc-300">What&apos;s different from file mode</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>No future: the noise floor is a sliding window, not the whole file.</li>
          <li>No look-back: a 50 ms onset delay replaces the minimum-duration filter, so clicks don&apos;t trigger it.</li>
          <li>Same features, same trained weights, same 100 Hz high-pass as the offline learned detector.</li>
        </ul>
      </section>
    </main>
  );
}

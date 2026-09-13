"use client";

import { useEffect, useState } from "react";
import { Controls } from "@/components/Controls";
import { EnergyTrack } from "@/components/EnergyTrack";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ParamSliders } from "@/components/ParamSliders";
import { Waveform } from "@/components/Waveform";
import { usePlayback } from "@/hooks/usePlayback";
import { evaluate, fetchParamSpecs, fetchSample, listSamples, runVad } from "@/lib/api";
import type { DetectorName, Metrics, Params, ParamSpec, SampleInfo, Segment, VadResponse } from "@/lib/types";

interface Audio {
  wav: ArrayBuffer;
  labels: Segment[] | null;
}

export default function Home() {
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [selectedSample, setSelectedSample] = useState("");
  const [method, setMethod] = useState<DetectorName>("spectral");
  const [specs, setSpecs] = useState<Partial<Record<DetectorName, ParamSpec[]>>>({});
  const [params, setParams] = useState<Params>({});
  const [audio, setAudio] = useState<Audio | null>(null);
  const [result, setResult] = useState<VadResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playback = usePlayback();

  useEffect(() => {
    listSamples().then(setSamples).catch((e: Error) => setError(e.message));
    fetchParamSpecs().then(setSpecs).catch((e: Error) => setError(e.message));
  }, []);

  async function analyze(next: Audio, detector: DetectorName, overrides: Params) {
    setBusy(true);
    setError(null);
    try {
      const res = await runVad(next.wav, detector, overrides);
      setResult(res);
      setMetrics(next.labels ? await evaluate(res, next.labels) : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadAudio(next: Audio) {
    setAudio(next);
    playback.load(next.wav);
    await analyze(next, method, params);
  }

  async function loadSample(name: string) {
    setSelectedSample(name);
    if (!name) return;
    try {
      await loadAudio(await fetchSample(name));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadUpload(file: File) {
    setSelectedSample("");
    await loadAudio({ wav: await file.arrayBuffer(), labels: null });
  }

  async function changeMethod(next: DetectorName) {
    setMethod(next);
    setParams({});
    if (audio) await analyze(audio, next, {});
  }

  async function commitParams(next: Params) {
    if (audio) await analyze(audio, method, next);
  }

  async function resetParams() {
    setParams({});
    if (audio) await analyze(audio, method, {});
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">VAD from scratch</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Voice activity detection in TypeScript — no ML libraries, no audio libraries.
        </p>
      </header>

      <Controls
        samples={samples}
        selectedSample={selectedSample}
        method={method}
        busy={busy}
        onSample={loadSample}
        onUpload={loadUpload}
        onMethod={changeMethod}
      />

      {specs[method] && (
        <ParamSliders
          specs={specs[method]}
          values={params}
          disabled={busy}
          onChange={setParams}
          onCommit={commitParams}
          onReset={resetParams}
        />
      )}

      {error && <div className="rounded-md border border-rose-900 bg-rose-950 p-3 text-sm text-rose-200">{error}</div>}

      {result && (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>
                {result.segments.length} segment{result.segments.length === 1 ? "" : "s"} ·{" "}
                {result.durationSec.toFixed(2)} s · {result.elapsedMs} ms
              </span>
              <button
                type="button"
                onClick={playback.toggle}
                className="rounded-md bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700"
              >
                {playback.playing ? "Pause" : "Play"}
              </button>
            </div>
            <Waveform
              peaks={result.waveform}
              detected={result.segments}
              truth={audio?.labels ?? null}
              playhead={playback.time}
              onSeek={playback.seek}
            />
            <Legend hasTruth={audio?.labels !== null} />
          </section>

          <section className="flex flex-col gap-2">
            <div className="text-sm text-zinc-400">
              {method === "learned"
                ? `Speech probability · threshold ${result.threshold.toFixed(2)}`
                : `Frame energy (dB) · threshold ${result.threshold.toFixed(1)} dB`}
            </div>
            <EnergyTrack
              scores={result.frameScores}
              decisions={result.frameDecisions}
              threshold={result.threshold}
              scale={method === "learned" ? "probability" : "db"}
            />
          </section>

          {metrics && <MetricsPanel metrics={metrics} />}

          <SegmentTable segments={result.segments} />
        </>
      )}
    </main>
  );
}

function Legend({ hasTruth }: { hasTruth: boolean }) {
  return (
    <div className="flex gap-4 text-xs text-zinc-500">
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-3 rounded-sm bg-emerald-400/30" /> detected speech
      </span>
      {hasTruth && (
        <span className="flex items-center gap-1">
          <i className="inline-block h-1.5 w-3 rounded-sm bg-amber-400" /> ground truth
        </span>
      )}
    </div>
  );
}

function SegmentTable({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) return <p className="text-sm text-zinc-500">No speech detected.</p>;
  return (
    <table className="w-full text-left font-mono text-sm">
      <thead className="text-xs uppercase text-zinc-500">
        <tr>
          <th className="py-1">#</th>
          <th>start</th>
          <th>end</th>
          <th>length</th>
        </tr>
      </thead>
      <tbody className="text-zinc-300">
        {segments.map((s, i) => (
          <tr key={i} className="border-t border-zinc-800">
            <td className="py-1">{i + 1}</td>
            <td>{s.start.toFixed(2)} s</td>
            <td>{s.end.toFixed(2)} s</td>
            <td>{(s.end - s.start).toFixed(2)} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

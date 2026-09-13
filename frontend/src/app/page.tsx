"use client";

import { useEffect, useState } from "react";
import { DetectorPicker } from "@/components/DetectorPicker";
import { EnergyTrack } from "@/components/EnergyTrack";
import { Explainer } from "@/components/Explainer";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ParamSliders } from "@/components/ParamSliders";
import { SourcePicker } from "@/components/SourcePicker";
import { Waveform } from "@/components/Waveform";
import { usePlayback } from "@/hooks/usePlayback";
import { evaluate, fetchParamSpecs, fetchSample, listSamples, runVad } from "@/lib/api";
import type { DetectorName, Metrics, Params, ParamSpec, SampleInfo, Segment, VadResponse } from "@/lib/types";

interface Audio {
  wav: ArrayBuffer;
  labels: Segment[] | null;
}

const DEFAULT_SAMPLE = "speech-with-bursts";

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
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const playback = usePlayback();

  // One-time bootstrap: sample list, parameter specs, and a default file so
  // the page is never empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, paramSpecs] = await Promise.all([listSamples(), fetchParamSpecs()]);
        if (cancelled) return;
        setSamples(list);
        setSpecs(paramSpecs);
        if (list.some((s) => s.name === DEFAULT_SAMPLE)) {
          const first = await fetchSample(DEFAULT_SAMPLE);
          if (cancelled) return;
          setSelectedSample(DEFAULT_SAMPLE);
          setAudio(first);
          playback.load(first.wav);
          await analyze(first, "spectral", {});
        }
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Where is the speech?</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Pick a sample or upload a WAV. Green is what the detector calls speech; the amber band is the truth where we
          have it. Switch detectors and drag the sliders to see each decision move.
        </p>
      </header>

      {offline && (
        <div className="rounded-lg border border-amber-900 bg-amber-950/60 p-4 text-sm text-amber-200">
          <p className="font-medium">Backend not reachable.</p>
          <p className="mt-1 text-amber-200/80">
            Start it with <code className="rounded bg-zinc-900 px-1 py-0.5">cd backend && npm run dev</code> and reload.
          </p>
        </div>
      )}

      <section className="grid gap-5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 md:grid-cols-[1fr_auto]">
        <SourcePicker
          samples={samples}
          selected={selectedSample}
          disabled={busy || offline}
          onSample={loadSample}
          onUpload={loadUpload}
        />
        <div className="flex min-w-72 flex-col gap-1 text-sm">
          <span className="text-zinc-400">Detector</span>
          <DetectorPicker value={method} disabled={busy || offline} onChange={changeMethod} />
        </div>
      </section>

      {error && <div className="rounded-md border border-rose-900 bg-rose-950 p-3 text-sm text-rose-200">{error}</div>}

      {result && (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>
                <span className="text-zinc-200">{result.segments.length}</span> segment
                {result.segments.length === 1 ? "" : "s"} · {result.durationSec.toFixed(1)} s ·{" "}
                <span className="font-mono">{result.elapsedMs} ms</span>
              </span>
              <button
                type="button"
                onClick={playback.toggle}
                className="rounded-md bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700"
              >
                {playback.playing ? "Pause" : "▶ Play"}
              </button>
            </div>
            <Waveform
              peaks={result.waveform}
              detected={result.segments}
              truth={audio?.labels ?? null}
              playhead={playback.time}
              onSeek={playback.seek}
            />
            <Legend hasTruth={audio?.labels != null} />
          </section>

          <section className="flex flex-col gap-2">
            <div className="text-sm text-zinc-400">
              {method === "learned"
                ? `Speech probability per frame · threshold ${result.threshold.toFixed(2)}`
                : `Loudness per frame (dB) · threshold ${result.threshold.toFixed(1)} dB`}
              <span className="ml-2 text-zinc-600">green = called speech</span>
            </div>
            <EnergyTrack
              scores={result.frameScores}
              decisions={result.frameDecisions}
              threshold={result.threshold}
              scale={method === "learned" ? "probability" : "db"}
            />
          </section>

          {metrics && <MetricsPanel metrics={metrics} />}

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

          <SegmentTable segments={result.segments} />
        </>
      )}

      <Explainer />
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
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-px bg-zinc-100" /> playhead — click the waveform to seek
      </span>
    </div>
  );
}

function SegmentTable({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) return <p className="text-sm text-zinc-500">No speech detected.</p>;
  return (
    <details className="group rounded-lg border border-zinc-800">
      <summary className="cursor-pointer select-none px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
        Segment list ({segments.length})
      </summary>
      <div className="max-h-64 overflow-auto border-t border-zinc-800">
        <table className="w-full text-left font-mono text-sm">
          <thead className="sticky top-0 bg-zinc-950 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-1">#</th>
              <th>start</th>
              <th>end</th>
              <th>length</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {segments.map((s, i) => (
              <tr key={i} className="border-t border-zinc-800/60">
                <td className="px-4 py-1">{i + 1}</td>
                <td>{s.start.toFixed(2)} s</td>
                <td>{s.end.toFixed(2)} s</td>
                <td>{(s.end - s.start).toFixed(2)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

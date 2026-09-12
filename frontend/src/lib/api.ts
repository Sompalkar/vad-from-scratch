import type { DetectorName, Metrics, SampleInfo, Segment, VadResponse } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function listSamples(): Promise<SampleInfo[]> {
  return request("/samples");
}

export async function fetchSample(name: string): Promise<{ wav: ArrayBuffer; labels: Segment[] | null }> {
  const wav = await fetch(`${BASE}/samples/${name}.wav`).then((r) => r.arrayBuffer());
  const labels = await fetch(`${BASE}/samples/${name}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j ? (j.speech as Segment[]) : null))
    .catch(() => null);
  return { wav, labels };
}

export function runVad(wav: ArrayBuffer, method: DetectorName): Promise<VadResponse> {
  return request(`/vad?method=${method}`, { method: "POST", body: wav });
}

export function evaluate(result: VadResponse, truth: Segment[]): Promise<Metrics> {
  return request("/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frameTimes: result.frameTimes,
      frameDecisions: result.frameDecisions,
      truth,
    }),
  });
}

import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../audio/wav.js";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";
import { createVadServer } from "./server.js";

const server = createVadServer();
let base = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const speech = [{ start: 1, end: 2 }];
const wav = encodeWav({ samples: synthesize({ durationSec: 3, speech }), sampleRate: SAMPLE_RATE });

describe("GET /health", () => {
  it("lists detectors", async () => {
    const body = await (await fetch(`${base}/health`)).json();
    expect(body).toEqual({ ok: true, detectors: ["energy", "spectral"] });
  });
});

describe("POST /vad", () => {
  it("returns segments and waveform for a WAV body", async () => {
    const res = await fetch(`${base}/vad?method=energy`, { method: "POST", body: wav });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe("energy");
    expect(body.segments).toHaveLength(1);
    expect(body.segments[0].start).toBeCloseTo(1, 1);
    expect(body.waveform.min.length).toBeGreaterThan(0);
    expect(body.frameTimes.length).toBe(body.frameDecisions.length);
  });

  it("rejects an unknown method", async () => {
    const res = await fetch(`${base}/vad?method=magic`, { method: "POST", body: wav });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown method/);
  });

  it("rejects a non-WAV body", async () => {
    const res = await fetch(`${base}/vad`, { method: "POST", body: "hello" });
    expect(res.status).toBe(400);
  });
});

describe("POST /evaluate", () => {
  it("scores predictions against truth", async () => {
    const vad = await (await fetch(`${base}/vad?method=spectral`, { method: "POST", body: wav })).json();
    const res = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frameTimes: vad.frameTimes, frameDecisions: vad.frameDecisions, truth: speech }),
    });
    const metrics = await res.json();
    expect(metrics.recall).toBeGreaterThan(0.95);
    expect(metrics.f1).toBeGreaterThan(0.85);
  });
});

describe("GET /samples", () => {
  it("lists bundled samples with label availability", async () => {
    const list = await (await fetch(`${base}/samples`)).json();
    expect(list).toContainEqual({ name: "clean-single", hasLabels: true });
  });

  it("serves a sample wav", async () => {
    const res = await fetch(`${base}/samples/clean-single.wav`);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(44);
  });

  it("refuses path traversal", async () => {
    const res = await fetch(`${base}/samples/..%2Fpackage.json`);
    expect(res.status).toBe(400);
  });
});

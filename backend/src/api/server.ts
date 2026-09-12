import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { decodeWav } from "../audio/wav.js";
import { frameMetrics, segmentsToFrames } from "../eval/metrics.js";
import { createDetector, DETECTORS, isDetectorName } from "../vad/index.js";
import type { Segment } from "../vad/smoothing.js";
import { listSamples, readSample } from "./samples.js";
import { waveformPeaks } from "./waveform.js";

const MAX_BODY_BYTES = 50 * 1024 * 1024;
const WAVEFORM_POINTS = 2000;

export function createVadServer(): Server {
  return createServer(handle);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // The Next.js dev server runs on a different port, so allow it.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, detectors: Object.keys(DETECTORS) });
    } else if (req.method === "POST" && url.pathname === "/vad") {
      await handleVad(req, res, url);
    } else if (req.method === "POST" && url.pathname === "/evaluate") {
      await handleEvaluate(req, res);
    } else if (req.method === "GET" && url.pathname === "/samples") {
      json(res, 200, await listSamples());
    } else if (req.method === "GET" && url.pathname.startsWith("/samples/")) {
      await handleSample(res, url.pathname.slice("/samples/".length));
    } else {
      json(res, 404, { error: "Not found" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    json(res, 400, { error: message });
  }
}

async function handleVad(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = url.searchParams.get("method") ?? "spectral";
  if (!isDetectorName(method)) {
    throw new Error(`Unknown method "${method}". Use one of: ${Object.keys(DETECTORS).join(", ")}`);
  }

  const body = await readBody(req);
  const audio = decodeWav(body);

  const started = performance.now();
  const result = createDetector(method).detect(audio.samples, audio.sampleRate);
  const elapsedMs = performance.now() - started;

  json(res, 200, {
    method,
    sampleRate: audio.sampleRate,
    durationSec: audio.samples.length / audio.sampleRate,
    elapsedMs: Math.round(elapsedMs * 10) / 10,
    segments: result.segments,
    threshold: result.threshold,
    frameTimes: result.frameTimes,
    frameScores: result.frameScores.map((s) => Math.round(s * 10) / 10),
    frameDecisions: result.frameDecisions,
    waveform: waveformPeaks(audio.samples, audio.sampleRate, WAVEFORM_POINTS),
  });
}

interface EvaluateBody {
  frameTimes: number[];
  frameDecisions: boolean[];
  truth: Segment[];
}

async function handleEvaluate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = JSON.parse((await readBody(req)).toString("utf8")) as EvaluateBody;
  const truthFrames = segmentsToFrames(body.truth, body.frameTimes);
  json(res, 200, frameMetrics(body.frameDecisions, truthFrames));
}

async function handleSample(res: ServerResponse, file: string): Promise<void> {
  const data = await readSample(file);
  const type = file.endsWith(".json") ? "application/json" : "audio/wav";
  res.writeHead(200, { "Content-Type": type });
  res.end(data);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

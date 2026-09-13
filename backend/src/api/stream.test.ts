import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { SAMPLE_RATE, synthesize } from "../test/synth.js";
import { createVadServer } from "./server.js";
import { attachStreamEndpoint } from "./stream.js";

const server = createVadServer();
attachStreamEndpoint(server);
let url = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `ws://localhost:${(server.address() as AddressInfo).port}/stream`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => ws.once("message", (d) => resolve(JSON.parse(d.toString()))));
}

describe("/stream", () => {
  it("returns frames for streamed audio", async () => {
    const ws = await connect();
    const ready = nextMessage(ws);
    ws.send(JSON.stringify({ type: "start", sampleRate: SAMPLE_RATE }));
    expect(await ready).toEqual({ type: "ready" });

    const audio = synthesize({ durationSec: 2, speech: [{ start: 1, end: 2 }] });
    const reply = nextMessage(ws);
    ws.send(audio.buffer.slice(0, audio.byteLength), { binary: true });
    const message = (await reply) as { type: string; frames: { speech: boolean }[] };

    expect(message.type).toBe("frames");
    expect(message.frames.length).toBeGreaterThan(150);
    expect(message.frames.some((f) => f.speech)).toBe(true);
    ws.close();
  });

  it("errors on audio before start", async () => {
    const ws = await connect();
    const reply = nextMessage(ws);
    ws.send(new Float32Array(1024).buffer, { binary: true });
    expect((await reply).type).toBe("error");
    ws.close();
  });
});

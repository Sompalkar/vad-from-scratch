/**
 * WebSocket endpoint for live VAD.
 *
 * Client → server: a JSON text message `{ type: "start", sampleRate }`, then
 * binary messages of little-endian Float32 PCM samples.
 * Server → client: JSON arrays of StreamFrame for each chunk processed.
 */
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { StreamingVad } from "../vad/streaming.js";

const MIN_SAMPLE_RATE = 8000;
const MAX_SAMPLE_RATE = 48000;

export function attachStreamEndpoint(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/stream" });
  wss.on("connection", handleConnection);
}

function handleConnection(socket: WebSocket): void {
  let vad: StreamingVad | null = null;

  socket.on("message", (data, isBinary) => {
    try {
      if (!isBinary) {
        const message = JSON.parse(data.toString()) as { type?: string; sampleRate?: number };
        if (message.type !== "start" || !message.sampleRate) throw new Error("Expected a start message");
        if (message.sampleRate < MIN_SAMPLE_RATE || message.sampleRate > MAX_SAMPLE_RATE) {
          throw new Error(`Sample rate must be ${MIN_SAMPLE_RATE}–${MAX_SAMPLE_RATE}`);
        }
        vad = new StreamingVad(message.sampleRate);
        socket.send(JSON.stringify({ type: "ready" }));
        return;
      }

      if (!vad) throw new Error("Send a start message before audio");
      const bytes = toBuffer(data);
      const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      const frames = vad.push(samples);
      if (frames.length > 0) socket.send(JSON.stringify({ type: "frames", frames }));
    } catch (err) {
      socket.send(JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Unknown error" }));
    }
  });
}

/** ws hands us Buffer | ArrayBuffer | Buffer[]; normalise to one aligned Buffer. */
function toBuffer(data: Buffer | ArrayBuffer | Buffer[]): Buffer {
  const joined = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
  // Float32Array needs 4-byte alignment; Buffer slices from ws may not be.
  return joined.byteOffset % 4 === 0 ? joined : Buffer.from(joined);
}

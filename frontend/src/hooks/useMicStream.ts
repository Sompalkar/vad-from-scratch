"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveFrame {
  time: number;
  score: number;
  speech: boolean;
  noiseFloorDb: number;
  energyDb: number;
}

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/^http/, "ws") + "/stream";
const SAMPLE_RATE = 16000;
const HISTORY = 600; // frames kept for display (6 s at 10 ms hop)

/**
 * Captures the microphone, streams PCM to the backend over WebSocket, and
 * keeps a rolling window of the frames it sends back.
 */
export function useMicStream() {
  const [frames, setFrames] = useState<LiveFrame[]>([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void contextRef.current?.close();
    socketRef.current = null;
    streamRef.current = null;
    contextRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const socket = new WebSocket(WS_URL);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error("Backend not reachable. Start it with `cd backend && npm run dev`."));
      });
      socket.send(JSON.stringify({ type: "start", sampleRate: SAMPLE_RATE }));
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as { type: string; frames?: LiveFrame[]; error?: string };
        if (message.type === "frames" && message.frames) {
          setFrames((prev) => [...prev, ...message.frames!].slice(-HISTORY));
        } else if (message.type === "error") {
          setError(message.error ?? "Stream error");
        }
      };

      const stream = await navigator.mediaDevices
        .getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false },
        })
        .catch(() => {
          throw new Error("Microphone permission denied. Allow the microphone for this site and try again.");
        });
      const context = new AudioContext({ sampleRate: SAMPLE_RATE });
      await context.audioWorklet.addModule("/pcm-worklet.js");
      const source = context.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(context, "pcm-forwarder");
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(event.data.buffer);
      };
      source.connect(worklet);

      socketRef.current = socket;
      streamRef.current = stream;
      contextRef.current = context;
      setFrames([]);
      setActive(true);
    } catch (e) {
      stop();
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }, [stop]);

  return { frames, active, connecting, error, start, stop };
}

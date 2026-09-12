"use client";

import { useEffect, useRef } from "react";
import type { Segment, WaveformPeaks } from "@/lib/types";

interface Props {
  peaks: WaveformPeaks;
  detected: Segment[];
  truth: Segment[] | null;
  /** Seconds. Drawn as a vertical line while audio plays. */
  playhead: number | null;
  onSeek?: (seconds: number) => void;
}

const HEIGHT = 160;

/**
 * Draws min/max peaks per column, with detected speech shaded on top and
 * ground-truth (if any) as a thin band underneath so both are visible.
 */
export function Waveform({ peaks, detected, truth, playhead, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match device pixels so lines are crisp on retina displays.
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const secToX = (s: number) => (s / peaks.durationSec) * width;

    ctx.clearRect(0, 0, width, HEIGHT);

    // Detected speech regions
    ctx.fillStyle = "rgba(52, 211, 153, 0.18)";
    for (const seg of detected) {
      ctx.fillRect(secToX(seg.start), 0, secToX(seg.end) - secToX(seg.start), HEIGHT);
    }

    // Ground truth band along the bottom
    if (truth) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      for (const seg of truth) {
        ctx.fillRect(secToX(seg.start), HEIGHT - 6, secToX(seg.end) - secToX(seg.start), 6);
      }
    }

    // Waveform: one vertical line per column, from min to max
    const mid = HEIGHT / 2;
    const columns = peaks.min.length;
    ctx.strokeStyle = "rgb(161, 161, 170)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < columns; i++) {
      const x = (i / columns) * width;
      const lo = peaks.min[i] ?? 0;
      const hi = peaks.max[i] ?? 0;
      ctx.moveTo(x, mid - hi * mid);
      ctx.lineTo(x, mid - lo * mid);
    }
    ctx.stroke();

    if (playhead !== null) {
      ctx.strokeStyle = "rgb(244, 244, 245)";
      ctx.lineWidth = 1.5;
      const x = secToX(playhead);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
  }, [peaks, detected, truth, playhead]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full cursor-pointer rounded-md bg-zinc-900"
      style={{ height: HEIGHT }}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - rect.left) / rect.width) * peaks.durationSec);
      }}
    />
  );
}

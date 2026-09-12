"use client";

import { useEffect, useRef } from "react";

interface Props {
  scores: number[];
  decisions: boolean[];
  threshold: number;
}

const HEIGHT = 90;
const MIN_DB = -80;
const MAX_DB = 0;

/**
 * Per-frame energy (dB) as a bar chart with the adaptive threshold drawn
 * across it. Bars above the line are what the detector calls speech.
 */
export function EnergyTrack({ scores, decisions, threshold }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const dbToY = (db: number) => {
      const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
      return HEIGHT - ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * HEIGHT;
    };

    ctx.clearRect(0, 0, width, HEIGHT);
    const barWidth = width / scores.length;
    for (let i = 0; i < scores.length; i++) {
      const y = dbToY(scores[i] ?? MIN_DB);
      ctx.fillStyle = decisions[i] ? "rgb(52, 211, 153)" : "rgb(82, 82, 91)";
      ctx.fillRect(i * barWidth, y, Math.max(1, barWidth), HEIGHT - y);
    }

    const ty = dbToY(threshold);
    ctx.strokeStyle = "rgb(251, 113, 133)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(width, ty);
    ctx.stroke();
  }, [scores, decisions, threshold]);

  return <canvas ref={canvasRef} className="w-full rounded-md bg-zinc-900" style={{ height: HEIGHT }} />;
}

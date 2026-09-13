"use client";

import { useCallback } from "react";
import { useCanvas, type Draw } from "@/hooks/useCanvas";

interface Props {
  scores: number[];
  decisions: boolean[];
  threshold: number;
  /** "db" for energy-style scores, "probability" for 0–1 model outputs. */
  scale: "db" | "probability";
}

const HEIGHT = 90;
const RANGES = { db: [-80, 0], probability: [0, 1] } as const;

/**
 * Per-frame score as a bar chart with the threshold drawn across it.
 * Bars above the line are what the detector calls speech.
 */
export function EnergyTrack({ scores, decisions, threshold, scale }: Props) {
  const draw = useCallback<Draw>(
    (ctx, width, height) => {
      const [min, max] = RANGES[scale];
      const toY = (v: number) => {
        const clamped = Math.max(min, Math.min(max, v));
        return height - ((clamped - min) / (max - min)) * height;
      };

      const barWidth = width / scores.length;
      for (let i = 0; i < scores.length; i++) {
        const y = toY(scores[i] ?? min);
        ctx.fillStyle = decisions[i] ? "rgb(52, 211, 153)" : "rgb(82, 82, 91)";
        ctx.fillRect(i * barWidth, y, Math.max(1, barWidth), height - y);
      }

      ctx.strokeStyle = "rgb(251, 113, 133)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, toY(threshold));
      ctx.lineTo(width, toY(threshold));
      ctx.stroke();
    },
    [scores, decisions, threshold, scale],
  );

  const ref = useCanvas(draw, HEIGHT);
  return <canvas ref={ref} className="w-full rounded-md bg-zinc-900" style={{ height: HEIGHT }} />;
}

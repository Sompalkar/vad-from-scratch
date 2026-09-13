"use client";

import { useCallback } from "react";
import { useCanvas, type Draw } from "@/hooks/useCanvas";
import type { LiveFrame } from "@/hooks/useMicStream";

interface Props {
  frames: LiveFrame[];
  capacity: number;
  threshold: number;
}

const HEIGHT = 140;

/** Scrolling strip of speech probability, newest frame on the right. */
export function LiveMeter({ frames, capacity, threshold }: Props) {
  const draw = useCallback<Draw>(
    (ctx, width, height) => {
      const barWidth = width / capacity;
      const offset = capacity - frames.length;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i]!;
        const barHeight = Math.max(1, f.score * height);
        ctx.fillStyle = f.speech ? "rgb(52, 211, 153)" : "rgb(82, 82, 91)";
        ctx.fillRect((offset + i) * barWidth, height - barHeight, Math.max(1, barWidth), barHeight);
      }

      const ty = height - threshold * height;
      ctx.strokeStyle = "rgb(251, 113, 133)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(width, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Seconds-ago ticks along the bottom
      ctx.fillStyle = "rgb(113, 113, 122)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      const secondsShown = capacity / 100;
      for (let s = 1; s < secondsShown; s++) {
        const x = width - (s / secondsShown) * width;
        ctx.fillText(`-${s}s`, x, height - 4);
      }
    },
    [frames, capacity, threshold],
  );

  const ref = useCanvas(draw, HEIGHT);
  return <canvas ref={ref} className="w-full rounded-md bg-zinc-900" style={{ height: HEIGHT }} />;
}

interface LevelProps {
  levelDb: number | null;
  floorDb: number | null;
  marginDb: number;
}

const MIN_DB = -80;

/** Horizontal loudness bar with the noise floor and the speech gate marked. */
export function LevelBar({ levelDb, floorDb, marginDb }: LevelProps) {
  const pct = (db: number) => `${Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100))}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-3 overflow-hidden rounded-full bg-zinc-800">
        {levelDb !== null && (
          <div className="absolute inset-y-0 left-0 bg-zinc-400 transition-[width] duration-75" style={{ width: pct(levelDb) }} />
        )}
        {floorDb !== null && (
          <>
            <div className="absolute inset-y-0 w-px bg-sky-400" style={{ left: pct(floorDb) }} title="noise floor" />
            <div
              className="absolute inset-y-0 w-px bg-rose-400"
              style={{ left: pct(floorDb + marginDb) }}
              title="speech gate"
            />
          </>
        )}
      </div>
      <div className="flex justify-between font-mono text-xs text-zinc-500">
        <span>{levelDb !== null ? `${levelDb.toFixed(0)} dB` : "—"}</span>
        <span>
          <span className="text-sky-400">|</span> floor {floorDb !== null ? `${floorDb.toFixed(0)} dB` : "—"}{" "}
          <span className="ml-2 text-rose-400">|</span> gate +{marginDb} dB
        </span>
      </div>
    </div>
  );
}

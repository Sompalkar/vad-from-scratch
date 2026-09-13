"use client";

import { useCallback } from "react";
import { useCanvas, type Draw } from "@/hooks/useCanvas";
import type { LiveFrame } from "@/hooks/useMicStream";

interface Props {
  frames: LiveFrame[];
  capacity: number;
}

const HEIGHT = 120;

/** Scrolling strip of speech probability, newest frame on the right. */
export function LiveMeter({ frames, capacity }: Props) {
  const draw = useCallback<Draw>(
    (ctx, width, height) => {
      const barWidth = width / capacity;
      const offset = capacity - frames.length;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i]!;
        const barHeight = f.score * height;
        ctx.fillStyle = f.speech ? "rgb(52, 211, 153)" : "rgb(82, 82, 91)";
        ctx.fillRect((offset + i) * barWidth, height - barHeight, Math.max(1, barWidth), barHeight);
      }
      ctx.strokeStyle = "rgb(251, 113, 133)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    },
    [frames, capacity],
  );

  const ref = useCanvas(draw, HEIGHT);
  return <canvas ref={ref} className="w-full rounded-md bg-zinc-900" style={{ height: HEIGHT }} />;
}

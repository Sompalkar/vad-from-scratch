"use client";

import { useCallback } from "react";
import { useCanvas, type Draw } from "@/hooks/useCanvas";
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
  const draw = useCallback<Draw>(
    (ctx, width, height) => {
      const secToX = (s: number) => (s / peaks.durationSec) * width;

      ctx.fillStyle = "rgba(52, 211, 153, 0.18)";
      for (const seg of detected) {
        ctx.fillRect(secToX(seg.start), 0, secToX(seg.end) - secToX(seg.start), height);
      }

      if (truth) {
        ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
        for (const seg of truth) {
          ctx.fillRect(secToX(seg.start), height - 6, secToX(seg.end) - secToX(seg.start), 6);
        }
      }

      const mid = height / 2;
      const columns = peaks.min.length;
      ctx.strokeStyle = "rgb(161, 161, 170)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < columns; i++) {
        const x = (i / columns) * width;
        ctx.moveTo(x, mid - (peaks.max[i] ?? 0) * mid);
        ctx.lineTo(x, mid - (peaks.min[i] ?? 0) * mid);
      }
      ctx.stroke();

      // Time axis: a tick every second, labelled every few depending on length.
      const labelEvery = peaks.durationSec > 20 ? 5 : peaks.durationSec > 8 ? 2 : 1;
      ctx.fillStyle = "rgb(113, 113, 122)";
      ctx.strokeStyle = "rgba(113, 113, 122, 0.4)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      for (let s = 0; s <= peaks.durationSec; s++) {
        const x = secToX(s);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, s % labelEvery === 0 ? 8 : 4);
        ctx.stroke();
        if (s % labelEvery === 0 && s > 0) ctx.fillText(`${s}s`, x, 18);
      }

      if (playhead !== null) {
        ctx.strokeStyle = "rgb(244, 244, 245)";
        ctx.lineWidth = 1.5;
        const x = secToX(playhead);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    },
    [peaks, detected, truth, playhead],
  );

  const ref = useCanvas(draw, HEIGHT);

  return (
    <canvas
      ref={ref}
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

"use client";

import { useEffect, useRef, type RefObject } from "react";

export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * Runs `draw` whenever it changes or the canvas resizes. Handles the
 * device-pixel-ratio dance so lines are crisp on retina screens.
 *
 * The ResizeObserver matters: an effect that only runs on mount sees
 * clientWidth = 0 if the canvas isn't laid out yet (hidden tab, collapsed
 * pane) and never recovers.
 */
export function useCanvas(draw: Draw, height: number): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const render = () => {
      const ctx = canvas.getContext("2d");
      const width = canvas.clientWidth;
      if (!ctx || width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      draw(ctx, width, height);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw, height]);

  return ref;
}

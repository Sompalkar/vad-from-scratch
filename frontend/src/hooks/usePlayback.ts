"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps an <audio> element: exposes current time (updated every animation
 * frame while playing) plus load/play/pause/seek. Takes raw WAV bytes.
 */
export function usePlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const dispose = useCallback(() => {
    audioRef.current?.pause();
    cancelAnimationFrame(rafRef.current);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    audioRef.current = null;
    urlRef.current = null;
  }, []);

  useEffect(() => dispose, [dispose]);

  const load = useCallback(
    (wav: ArrayBuffer) => {
      dispose();
      const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      const audio = new Audio(url);
      audioRef.current = audio;
      urlRef.current = url;
      setTime(null);
      setPlaying(false);

      const tick = () => {
        setTime(audio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      audio.onplay = () => {
        setPlaying(true);
        tick();
      };
      audio.onpause = audio.onended = () => {
        setPlaying(false);
        cancelAnimationFrame(rafRef.current);
        setTime(audio.currentTime);
      };
    },
    [dispose],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setTime(seconds);
  }, []);

  return { time, playing, load, toggle, seek };
}

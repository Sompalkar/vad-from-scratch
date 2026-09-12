/**
 * Framing: slice a long signal into short, overlapping windows.
 *
 * Speech is only "stationary" over ~20-30 ms, so every VAD feature is
 * computed per frame rather than over the whole file. Overlap (hop < frame)
 * gives smoother decisions at word boundaries.
 */

export interface FrameConfig {
  /** Window length in milliseconds. */
  frameMs: number;
  /** Step between consecutive windows in milliseconds. */
  hopMs: number;
}

export const DEFAULT_FRAME_CONFIG: FrameConfig = { frameMs: 30, hopMs: 10 };

export interface Frames {
  /** frames[i] is a view into the signal — no copying. */
  frames: Float32Array[];
  /** Start time of each frame in seconds. */
  times: number[];
  frameLength: number;
  hopLength: number;
}

export function frameSignal(
  samples: Float32Array,
  sampleRate: number,
  config: FrameConfig = DEFAULT_FRAME_CONFIG,
): Frames {
  const frameLength = Math.round((config.frameMs / 1000) * sampleRate);
  const hopLength = Math.round((config.hopMs / 1000) * sampleRate);

  if (frameLength <= 0 || hopLength <= 0) {
    throw new Error("Frame and hop must be positive");
  }

  const frames: Float32Array[] = [];
  const times: number[] = [];

  for (let start = 0; start + frameLength <= samples.length; start += hopLength) {
    frames.push(samples.subarray(start, start + frameLength));
    times.push(start / sampleRate);
  }

  return { frames, times, frameLength, hopLength };
}

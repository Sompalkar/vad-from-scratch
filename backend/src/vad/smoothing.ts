/**
 * Turn noisy per-frame booleans into clean speech segments.
 *
 * Raw frame decisions flicker: a 10 ms dip between syllables would split a
 * word. Two fixes, applied in order:
 *
 *  1. Hangover — once speech is detected, keep it "on" for N more frames
 *     after the detector goes quiet. Bridges short gaps inside words.
 *  2. Minimum duration — drop speech runs shorter than M frames. Removes
 *     clicks and single-frame false positives.
 */

export interface SmoothingConfig {
  /** Frames to hold "speech" after the last positive frame. */
  hangoverFrames: number;
  /** Speech runs shorter than this are discarded. */
  minSpeechFrames: number;
}

export function applyHangover(decisions: boolean[], hangoverFrames: number): boolean[] {
  const out = new Array<boolean>(decisions.length);
  let remaining = 0;
  for (let i = 0; i < decisions.length; i++) {
    if (decisions[i]) {
      remaining = hangoverFrames;
      out[i] = true;
    } else if (remaining > 0) {
      remaining--;
      out[i] = true;
    } else {
      out[i] = false;
    }
  }
  return out;
}

export function dropShortRuns(decisions: boolean[], minFrames: number): boolean[] {
  const out = [...decisions];
  let runStart = -1;
  for (let i = 0; i <= decisions.length; i++) {
    const active = i < decisions.length && decisions[i];
    if (active && runStart < 0) {
      runStart = i;
    } else if (!active && runStart >= 0) {
      if (i - runStart < minFrames) out.fill(false, runStart, i);
      runStart = -1;
    }
  }
  return out;
}

export function smooth(decisions: boolean[], config: SmoothingConfig): boolean[] {
  return dropShortRuns(applyHangover(decisions, config.hangoverFrames), config.minSpeechFrames);
}

export interface Segment {
  /** Seconds. */
  start: number;
  end: number;
}

/** Collapse consecutive true frames into [start, end) time segments. */
export function toSegments(decisions: boolean[], times: number[], hopSeconds: number): Segment[] {
  const segments: Segment[] = [];
  let runStart = -1;
  for (let i = 0; i <= decisions.length; i++) {
    const active = i < decisions.length && decisions[i];
    if (active && runStart < 0) {
      runStart = i;
    } else if (!active && runStart >= 0) {
      const start = times[runStart] ?? 0;
      const end = (times[i - 1] ?? 0) + hopSeconds;
      segments.push({ start, end });
      runStart = -1;
    }
  }
  return segments;
}

/**
 * Streaming VAD: same features and model as the offline learned detector,
 * but the noise floor is tracked online instead of read off the whole file.
 *
 * The floor is the 10th percentile of frame energies over a sliding window
 * ("minimum statistics"). It needs no initial guess and cannot deadlock:
 * an earlier version froze the update while it believed it heard speech,
 * so a room the model misjudged stayed "speech" for ~30 s. See NOTES.md #14.
 *
 * Feed samples in any chunk size; decisions come out one frame at a time
 * with the same hangover / hysteresis behaviour as offline.
 */
import { DEFAULT_FRAME_CONFIG } from "../audio/frames.js";
import { magnitudeSpectrum } from "../dsp/fft.js";
import { DEFAULT_HIGHPASS_HZ, HighPass } from "../dsp/filter.js";
import { percentile } from "../dsp/stats.js";
import { predict, type LogisticModel } from "../ml/logistic.js";
import { bandEnergyRatio, energyDb, spectralFlatness, zeroCrossingRate } from "./features.js";
import model from "./model.json" with { type: "json" };

export interface StreamingConfig {
  threshold: number;
  hangoverFrames: number;
  /** Consecutive positive frames required before speech is declared. Filters clicks. */
  onsetFrames: number;
  /** Energy gate above the running noise floor, dB (enter / stay). */
  marginDb: number;
  exitMarginDb: number;
  /** Frames of history the noise floor is estimated over. */
  floorWindowFrames: number;
  /** Which percentile of that history is the floor. */
  floorPercentile: number;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  threshold: 0.5,
  hangoverFrames: 4,
  onsetFrames: 5,
  marginDb: 8,
  exitMarginDb: 4,
  floorWindowFrames: 300,
  floorPercentile: 0.1,
};

export interface StreamFrame {
  time: number;
  score: number;
  speech: boolean;
  noiseFloorDb: number;
}

export class StreamingVad {
  private readonly frameLength: number;
  private readonly hopLength: number;
  private buffer: Float32Array;
  private buffered = 0;
  private samplesSeen = 0;
  private readonly energyHistory: number[] = [];
  private noiseFloorDb = 0;
  private hangover = 0;
  private onset = 0;
  private loud = false;
  private readonly filter: HighPass;

  constructor(
    private readonly sampleRate: number,
    private readonly config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
    private readonly weights: LogisticModel = model,
  ) {
    this.frameLength = Math.round((DEFAULT_FRAME_CONFIG.frameMs / 1000) * sampleRate);
    this.hopLength = Math.round((DEFAULT_FRAME_CONFIG.hopMs / 1000) * sampleRate);
    this.buffer = new Float32Array(this.frameLength * 4);
    this.filter = new HighPass(sampleRate, DEFAULT_HIGHPASS_HZ);
  }

  /** Push a chunk of samples; returns every frame completed by this chunk. */
  push(chunk: Float32Array): StreamFrame[] {
    this.append(this.filter.process(Float32Array.from(chunk)));
    const out: StreamFrame[] = [];

    while (this.buffered >= this.frameLength) {
      const frame = this.buffer.subarray(0, this.frameLength);
      out.push(this.processFrame(frame));
      // Slide by one hop; keep the overlap for the next frame.
      this.buffer.copyWithin(0, this.hopLength, this.buffered);
      this.buffered -= this.hopLength;
      this.samplesSeen += this.hopLength;
    }
    return out;
  }

  private processFrame(frame: Float32Array): StreamFrame {
    const db = energyDb(frame);
    this.updateNoiseFloor(db);
    const spectrum = magnitudeSpectrum(frame);
    const score = predict(this.weights, [
      db - this.noiseFloorDb,
      spectralFlatness(spectrum),
      bandEnergyRatio(spectrum, this.sampleRate, 100, 4000),
      zeroCrossingRate(frame),
    ]);

    const above = db - this.noiseFloorDb;
    this.loud = this.loud ? above >= this.config.exitMarginDb : above > this.config.marginDb;
    const positive = this.loud && score > this.config.threshold;
    this.onset = positive ? this.onset + 1 : 0;

    let speech: boolean;
    if (this.onset >= this.config.onsetFrames) {
      this.hangover = this.config.hangoverFrames;
      speech = true;
    } else if (this.hangover > 0) {
      this.hangover--;
      speech = true;
    } else {
      speech = false;
    }

    return { time: this.samplesSeen / this.sampleRate, score, speech, noiseFloorDb: this.noiseFloorDb };
  }

  /** Sliding-window percentile: the quietest 10 % of the last 3 s. */
  private updateNoiseFloor(db: number): void {
    this.energyHistory.push(db);
    if (this.energyHistory.length > this.config.floorWindowFrames) this.energyHistory.shift();
    this.noiseFloorDb = percentile(this.energyHistory, this.config.floorPercentile);
  }

  private append(chunk: Float32Array): void {
    const needed = this.buffered + chunk.length;
    if (needed > this.buffer.length) {
      const grown = new Float32Array(Math.max(needed, this.buffer.length * 2));
      grown.set(this.buffer.subarray(0, this.buffered));
      this.buffer = grown;
    }
    this.buffer.set(chunk, this.buffered);
    this.buffered = needed;
  }
}

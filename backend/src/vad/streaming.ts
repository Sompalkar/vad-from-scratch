/**
 * Streaming VAD: same features and model as the offline learned detector,
 * but the noise floor is tracked online instead of read off the whole file.
 *
 * Feed samples in any chunk size; decisions come out one frame at a time
 * with the same hangover / hysteresis behaviour as offline.
 */
import { DEFAULT_FRAME_CONFIG } from "../audio/frames.js";
import { magnitudeSpectrum } from "../dsp/fft.js";
import { DEFAULT_HIGHPASS_HZ, HighPass } from "../dsp/filter.js";
import { predict, type LogisticModel } from "../ml/logistic.js";
import { bandEnergyRatio, energyDb, spectralFlatness, zeroCrossingRate } from "./features.js";
import model from "./model.json" with { type: "json" };

export interface StreamingConfig {
  threshold: number;
  hangoverFrames: number;
  /** Energy gate above the running noise floor, dB (enter / stay). */
  marginDb: number;
  exitMarginDb: number;
  /** Floor adaptation rate per non-speech frame (0–1). */
  floorRise: number;
  floorFall: number;
  /** Tiny unconditional rise so the floor can recover if it starts too low. */
  floorLeak: number;
  /** Starting floor estimate before any audio is seen. */
  initialFloorDb: number;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  threshold: 0.5,
  hangoverFrames: 4,
  marginDb: 8,
  exitMarginDb: 4,
  floorRise: 0.05,
  floorFall: 0.2,
  floorLeak: 0.0005,
  initialFloorDb: -60,
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
  private noiseFloorDb: number;
  private hangover = 0;
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
    this.noiseFloorDb = config.initialFloorDb;
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
    const spectrum = magnitudeSpectrum(frame);
    const score = predict(this.weights, [
      db - this.noiseFloorDb,
      spectralFlatness(spectrum),
      bandEnergyRatio(spectrum, this.sampleRate, 100, 4000),
      zeroCrossingRate(frame),
    ]);

    const above = db - this.noiseFloorDb;
    this.loud = this.loud ? above >= this.config.exitMarginDb : above > this.config.marginDb;
    const isSpeech = this.loud && score > this.config.threshold;
    this.updateNoiseFloor(db, isSpeech);

    let speech: boolean;
    if (isSpeech) {
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

  /**
   * Noise-floor tracking gated by the decision: adapt only on non-speech
   * frames, so speech can't drag the floor up. Falls fast (a fan switching
   * off is tracked immediately), rises slower. A tiny leak applies always,
   * so a floor that started far too low can still recover.
   */
  private updateNoiseFloor(db: number, isSpeech: boolean): void {
    const gap = db - this.noiseFloorDb;
    if (isSpeech) {
      this.noiseFloorDb += this.config.floorLeak * Math.max(0, gap);
      return;
    }
    const rate = gap < 0 ? this.config.floorFall : this.config.floorRise;
    this.noiseFloorDb += rate * gap;
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

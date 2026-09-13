# vad-from-scratch

A Voice Activity Detector built from scratch in TypeScript — no audio libraries, no ML libraries — with a Next.js UI to see it work.

Inspired by Sarvam AI's ML engineer screening task: build a VAD in 2.5 hours, judged on **accuracy**, **code quality**, and **proposed improvements**. This repo goes past the 2.5-hour version and builds the improvements too.

## What a VAD does

Given audio, decide for every 10 ms slice: is someone speaking? It's the first block in every speech pipeline — it trims silence, splits utterances, and stops the expensive model running on nothing.

## What's here

| layer | what | where |
|---|---|---|
| audio | RIFF/WAV decoder + encoder, 30 ms / 10 ms framing | `backend/src/audio` |
| DSP | radix-2 FFT, Hann window, percentile | `backend/src/dsp` |
| features | dB energy, zero-crossing rate, spectral flatness, speech-band ratio | `backend/src/vad/features.ts` |
| detectors | `energy`, `spectral`, `learned` (logistic regression) | `backend/src/vad` |
| smoothing | hysteresis, hangover, min-duration, segment extraction | `backend/src/vad/smoothing.ts` |
| streaming | online noise-floor tracking, chunked input | `backend/src/vad/streaming.ts` |
| ML | logistic regression by gradient descent, leave-one-out CV | `backend/src/ml` |
| eval | frame-level precision / recall / F1 | `backend/src/eval` |
| API | `POST /vad`, `POST /evaluate`, `WS /stream` — plain `node:http` + `ws` | `backend/src/api` |
| UI | waveform + regions, energy/threshold track, live sliders, mic mode | `frontend/src` |

## Detectors

**energy** — frame loudness in dB vs an adaptive threshold: noise floor (10th percentile of frame energies) + margin. Hysteresis: enter at +12 dB, exit at +6 dB.

**spectral** — the energy gate, plus two checks on *what* is loud: spectral flatness < 0.6 (speech is harmonic, noise is flat) and ≥ 65 % of energy in 100–4000 Hz. Applied per segment, not per frame, so fricatives don't punch holes in words. Rejects loud non-speech that energy VAD accepts.

**learned** — the same four features fed to a logistic regression trained on the labelled samples, with a 7-frame moving average over its probabilities. Trained with `npm run train`, which also reports leave-one-file-out F1.

## Accuracy

Frame-level F1 on the bundled labelled samples (`npm run eval`). `speech-*` files are real synthesised voices (macOS TTS, three speakers) placed on known noise with exact labels; the rest are fully synthetic tones.

| sample | energy | spectral | learned |
|---|---|---|---|
| speech-clean | 97.3% | 97.3% | 94.7% |
| speech-two-voices | 95.3% | 95.4% | 95.3% |
| speech-noisy | 85.4% | 88.7% | 91.3% |
| speech-quiet | 81.9% | 84.9% | 85.8% |
| speech-with-bursts | 88.9% | **94.9%** | 94.0% |
| with-noise-bursts | **82.0%** | **97.1%** | 96.9% |
| clean / noisy / quiet synthetic (4 files) | 97–98% | 97–98% | 97–98% |
| **mean (10 files)** | **92.1%** | **94.9%** | **94.8%** |

Two things to notice. Energy VAD is genuinely hard to beat on clean speech. And the first version of the spectral detector scored **65%** on real speech — every threshold tuned on synthetic data was wrong. [NOTES.md #10](NOTES.md) has the feature-distribution table that fixed it.

## Run

```bash
cd backend && npm install && npm run samples && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

- http://localhost:3000 — pick a sample or upload a WAV, switch detectors, drag the parameter sliders, watch the threshold line move
- http://localhost:3000/live — microphone → WebSocket → streaming detector, ~10 ms per decision

Backend scripts: `npm test` (49 tests), `npm run eval`, `npm run train`, `npm run samples` (synthetic), `npm run samples:speech` (real voices — macOS only, uses `say`; the output is already checked in).

## Build log

[NOTES.md](NOTES.md) records every problem hit and how it was solved — the fixture that wasn't speech, the hangover that was "wrong" but right, the noise floor that climbed 25 dB during speech, the canvas that drew at width 0. If you're preparing for a similar task, that file is the useful part.

## What I'd do next

- Real *recorded* audio with hand labels — the speech samples are TTS, which has no breaths, lip smacks or room reverb
- Replace logistic regression with a small MLP on a context window of frames (±5), so the model sees onset/offset shape, not one frame at a time
- Per-band noise floor (spectral subtraction) instead of a single dB floor
- Pitch detection (autocorrelation) as a fifth feature — the strongest single cue for voiced speech
- Run the streaming detector in the browser via the same TS code, no server round-trip

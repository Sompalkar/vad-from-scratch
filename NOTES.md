# Build log

Running notes on what was built, why, what broke, and how it was fixed.

## The problem

A VAD takes an audio waveform and answers, for every small slice of time, "is someone speaking here?". It sits in front of every ASR system: it trims silence, splits long audio into utterances, and avoids wasting compute on nothing.

The hard part is not the "obvious" cases (loud clear speech vs total silence). It's the edges: quiet speech, background noise, breaths, the first 20 ms of a word, the gap between two words in a sentence.

## Plan

1. Decode WAV into float samples
2. Frame the signal into 20–30 ms windows
3. Compute per-frame features (energy first, then spectral)
4. Decide speech / non-speech per frame with an adaptive threshold
5. Smooth decisions so we output clean segments, not flicker
6. Evaluate against labelled audio (frame-level precision / recall / F1)
7. Expose via HTTP, visualise in the browser

## Issues & decisions

_(appended as we go)_

### 1. Hangover shifts segment ends (energy VAD)

**Symptom:** test expected speech to end at 2.00 s, detector said 2.08 s.

**Cause:** not a bug. The hangover keeps "speech" on for 8 frames (80 ms) after energy drops, so trailing consonants and short intra-word gaps aren't chopped. Every segment end is therefore late by up to `hangoverFrames × hop`.

**Fix:** test asserts `end ∈ [2.0, 2.0 + hangover]`. Worth remembering: hangover trades end-precision for recall. If exact boundaries matter (e.g. for alignment), post-trim segments by the hangover length.

### Design: adaptive threshold via percentile

A fixed dB threshold breaks the moment the recording environment changes. We take the 10th percentile of frame energies as the noise floor and threshold 12 dB above it. Percentile (not min) so one freak frame of digital silence doesn't drag the floor to −200 dB; a `floorDb` clamp handles the all-silence file, where otherwise everything would be "speech".

### 2. Spectral VAD detected nothing — the test fixture was wrong

**Symptom:** new spectral detector returned zero segments on synthetic speech that energy VAD handled fine.

**Investigation:** printed the three features for one silence, one speech, one noise-burst frame:

| frame | dB | flatness | band ratio (300–3400 Hz) |
|---|---|---|---|
| silence | −46 | 0.81 | 0.39 |
| speech | −18 | 0.18 | **0.15** |
| burst | −11 | 0.88 | 0.44 |

Flatness separated speech from noise perfectly. Band ratio failed — the synthetic "speech" was five harmonics of 120 Hz with 1/n amplitudes, so 85% of its energy was *below* 300 Hz. Real speech isn't shaped like that: the vocal tract's formants (~500–2500 Hz) boost the mid harmonics, and that's where the energy lives.

**Fix:** the fixture, not the detector. Synthetic speech now uses 25 harmonics shaped by a three-formant Gaussian envelope. Band ratio → 1.0, all tests pass.

**Lesson:** when a detector "fails", measure the features before touching thresholds. The detector was right; the fake data wasn't speech.

### Design: why flatness + band ratio on top of energy

Energy VAD calls any loud sound speech. The two spectral checks encode what speech *is*: harmonic (low flatness) and mid-band (300–3400 Hz). White noise is flat (0.8+) and spreads evenly across 0–8 kHz (band ratio ≈ 0.4). Test `rejects a loud noise burst` shows energy VAD returning 2 segments vs spectral returning 1 on the same audio.

### Design: hand-written FFT

Radix-2 Cooley–Tukey, validated against an O(n²) reference DFT to 9 decimal places. Frames are Hann-windowed before the FFT — without the window, the hard frame edges leak energy into every bin and flatness reads as "noise" for everything.

### 3. `Buffer.buffer` is `ArrayBuffer | SharedArrayBuffer`

**Symptom:** `decodeWav(body.buffer.slice(...))` failed to typecheck — Node types allow a `Buffer` to be backed by a `SharedArrayBuffer`, and `DataView` wants a plain `ArrayBuffer`.

**Fix:** `decodeWav` now accepts `Uint8Array | ArrayBuffer` and builds the `DataView` over `(buffer, byteOffset, byteLength)`. Cleaner API for callers *and* avoids copying the request body.

### Design: API shape

- `POST /vad?method=…` takes raw WAV bytes (no multipart — simpler client and server), returns segments, per-frame scores/decisions, threshold, timing, and min/max waveform peaks downsampled to 2000 points for drawing.
- `POST /evaluate` takes the frame decisions back plus ground-truth segments and returns P/R/F1. Kept separate so `/vad` doesn't need to know about labels.
- Plain `node:http`, no framework. Two routes don't justify a dependency.

### Observation: energy vs spectral on `with-noise-bursts.wav`

| method | segments found | time |
|---|---|---|
| energy | 3 (includes the burst) | 1.4 ms |
| spectral | 2 (correct) | 8.9 ms |

Spectral F1 0.95, recall 1.0, precision 0.91 — the precision loss is the hangover tail on each segment.

### 4. React 19 lint: no `setState` synchronously inside an effect

**Symptom:** `react-hooks/set-state-in-effect` errored on `setBusy(true)` at the top of a `useEffect` that re-ran detection when `[audio, method]` changed, and on the reset in the playback hook's effect.

**Fix:** stop using effects for user-triggered work. `analyze(audio, method)` is a plain async function called from the sample/upload/detector handlers; `usePlayback` exposes `load(wav)` instead of watching a prop. The only remaining effect is the one-time samples fetch and the unmount cleanup. Less code, and it matches what the React docs recommend ("you might not need an effect").

### Design: what the UI shows and why

- **Waveform** with detected regions shaded and ground truth as a thin band underneath — disagreements are visible at a glance.
- **Frame energy track** with the adaptive threshold as a dashed line. This is the detector's actual decision surface; on `with-noise-bursts` the burst sits *above* the line but stays grey under spectral, which is the whole point of that detector.
- **Metrics** update live when switching detector — on the burst sample precision goes 90.9% (spectral) → 66.7% (energy).
- Waveform peaks come pre-downsampled from the backend (2000 min/max pairs) so the browser never touches raw samples.

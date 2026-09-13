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

### Design: hysteresis (two thresholds)

One threshold means a score hovering around it flickers speech/silence every frame. Hysteresis uses an *enter* threshold (floor + 12 dB) and a lower *exit* threshold (floor + 6 dB): once in speech, stay until energy drops well below where we came in. Same idea as a thermostat. Implemented as a tiny state machine in `smoothing.ts` and used by both detectors as the energy gate.

### 5. Tuning the hangover on synthetic data is a trap

`npm run eval` sweep of hangover length, mean F1 across the five samples:

| hangover | energy | spectral |
|---|---|---|
| 8 frames | 92.8% | 96.2% |
| 5 | 94.0% | 97.4% |
| 3 | 94.9% | 98.3% |
| 2 | 95.3% | 98.7% |

Strictly monotonic — shorter always wins. That's because the synthetic speech is a continuous tone with no internal pauses, so the hangover can only add false positives. Real speech has 30–80 ms silences inside words (stop-consonant closures), which is what hangover exists to bridge. Settled on **4 frames (40 ms)** as a compromise and did not chase the 98.7%. Lesson: a metric on synthetic data tells you the *direction* of a change, not the *value* to ship.

### Accuracy after hysteresis + hangover 4

| sample | energy F1 | spectral F1 |
|---|---|---|
| clean-multi | 97.3% | 97.3% |
| clean-single | 97.1% | 97.6% |
| noisy-background | 97.3% | 98.2% |
| quiet-speech | 98.5% | 99.0% |
| with-noise-bursts | 82.0% | 97.1% |
| **mean** | **94.5%** | **97.8%** |

### Design: learned detector (logistic regression, from scratch)

Hand-picked cutoffs ("flatness < 0.5 AND band > 0.6") are replaced by a model that learns the weights from labelled frames. Four features per frame: energy above the file's noise floor, spectral flatness, speech-band ratio, zero-crossing rate. Standardised, then logistic regression trained by batch gradient descent (`src/ml/logistic.ts`, ~80 lines, log-loss + L2). `npm run train` writes `src/vad/model.json`; the detector ships with those weights.

Learned weights make physical sense:

| feature | weight | reads as |
|---|---|---|
| energy above floor | +0.73 | louder → speech |
| flatness | −1.39 | flat spectrum → noise |
| band ratio | +1.48 | energy in 300–3400 Hz → speech |
| zcr | −1.47 | hissy → not voiced |

One function (`extractFrameFeatures`) feeds both training and inference, so there is no train/serve skew by construction.

### 6. Don't evaluate a model on its training data

First eval showed learned = 97.7%, same as spectral — meaningless, since it had seen every file. Added leave-one-file-out to `npm run train`: train on four, test on the fifth. Held-out mean is also 97.7%. Notably `with-noise-bursts` held out still scores 97.1% — the model never saw a burst in training but learned "flat = noise" from ordinary background frames. Caveat: all five files come from one synthesiser, so this shows generalisation across files, not across real recording conditions.

### 7. Canvases blank after adding sliders — the effect saw `clientWidth = 0`

**Symptom:** waveform and energy canvases rendered empty. `canvas.width` was 0 while `clientWidth` was 976.

**Cause:** the draw effect ran once on mount, at a moment when the canvas wasn't laid out yet (the browser pane was hidden), read `clientWidth = 0`, and never ran again. It had worked earlier purely by timing. The same bug would leave the waveform stretched after any window resize.

**Fix:** a `useCanvas(draw, height)` hook that owns the DPR setup and redraws through a `ResizeObserver`. Both canvas components shrank to just their draw function. Lesson: any canvas sized from the DOM needs a resize path, not just a mount path.

### Design: tunable parameters

`PARAM_SPECS` in the backend is an explicit allowlist (key, label, range, step, default) per detector. `/health` publishes it so the UI builds sliders from data; `/vad?params={…}` accepts overrides which `sanitizeParams` clamps to range and strips of unknown keys. Sliders update the label continuously but only re-run detection on release. Demo: on `with-noise-bursts` under spectral, push max flatness to 1 — the burst *stays* rejected because band ratio still catches it; push band ratio to 0.35 and it turns green. Each check is visibly independent.

### Design: streaming mode

Offline detectors read the 10th percentile of *all* frame energies as the noise floor. Live audio has no future, so `StreamingVad` tracks the floor online: a stateful class that accepts samples in any chunk size, keeps a rolling buffer with the 20 ms overlap, and emits one decision per 10 ms hop. Same features and trained weights as the offline learned detector.

Transport: browser `AudioWorklet` (16 kHz mono, 1024-sample chunks) → WebSocket `/stream` → JSON frames back. `ws` is the project's only runtime dependency; hand-rolling WebSocket framing isn't where the learning is.

### 8. Noise floor climbed 25 dB during speech

**Symptom:** first streaming test — the running noise-floor estimate rose from −46 dB to −21 dB across one second of speech, so the *next* utterance would have been nearly invisible.

**Cause:** a plain exponential moving average with rise rate 0.01/frame. At 100 frames/s that closes 63% of the gap every second, and speech is a 37 dB gap.

**Fix:** gate the floor update on the decision — adapt only during non-speech frames (rise 0.05, fall 0.2). Plus a tiny unconditional leak (0.0005) so a floor that starts far too low can still climb out. This is the textbook "decision-directed noise estimation" and it's why every real VAD is a feedback loop, not a pure function. Test now asserts floor drift < 3 dB across an utterance.

### 9. GitHub API outage mid-project (not a code issue, but it cost time)

PR creation and merges returned 500/502 for ~40 minutes while GitHub's status page said "operational". Bisecting branches and commit contents proved nothing — a trivial control branch off `main` failed too. Lessons: check with a control before bisecting your own work, and keep stacking branches locally so the outage doesn't block building. Because squash-merge rewrites history, each stacked branch was rebased onto the new `main` with `git rebase --onto main <old-parent>` before its PR was merged, keeping every PR diff to just its own commits.

### 10. First contact with real speech: spectral collapsed to 65%, learned to 90%

Generated real speech with macOS `say` (three voices, six phrases), trimmed each phrase, and assembled files with known gaps, noise and bursts so labels are exact (`npm run samples:speech`). First eval on those five files:

| detector | synthetic mean | real-speech mean |
|---|---|---|
| energy | 94.5% | 92.1% |
| spectral | 97.8% | **65.1%** |
| learned | 97.7% | **90.1%** |

The simplest detector was the most robust. Measured feature distributions on loud frames, speech vs non-speech:

| feature | speech p10 / p50 / p90 | non-speech p10 / p50 / p90 |
|---|---|---|
| flatness | 0.16 / 0.34 / 0.59 | 0.61 / 0.85 / 0.86 |
| band 300–3400 Hz | 0.06 / 0.41 / 0.74 | 0.33 / 0.39 / 0.47 |
| band 100–4000 Hz | 0.74 / 0.98 / 1.00 | 0.43 / 0.49 / 0.72 |

Three fixes, all from the table rather than intuition:

1. **The 300–3400 Hz band was useless** on real voices (speech median 0.41 vs noise 0.39). The telephone band is where speech is *intelligible*, not where its energy is — the fundamental and first formant sit below 300 Hz. Switched to 100–4000 Hz, which separates cleanly.
2. **Flatness cutoff 0.5 → 0.6.** 0.5 discarded a third of real speech frames.
3. **Segment-level verification instead of per-frame AND.** Fricatives ("s", "f") are spectrally noise-like, so a per-frame rule punched holes in words. Now energy hysteresis proposes segments and a segment survives if ≥ 30% of its frames look like speech. Bursts fail ~100% of frames; sentences fail only their fricatives.

Retrained the model on all ten files. After: energy 92.1%, spectral **94.9%**, learned **94.8%** (leave-one-out 92.5%). Streaming detector on real speech over WebSocket: F1 0.94.

**Lesson:** every threshold that looked fine on synthetic data was wrong on real audio, and the *direction* of wrong was not guessable. Get real data as early as possible, even imperfect real data.

### 11. Linear model's thin margin on noise bursts

After retraining on real speech, the learned model scores synthetic noise bursts at ~0.46 — under the 0.5 line, but barely, and single frames tip over. Raising the threshold costs 1.5–5% recall on quiet speech for almost no gain, so 0.5 stays. Added a 7-frame moving average over probabilities before thresholding: a burst hovering at 0.46 stays a burst, a word at 1.0 with one "s" at 0.4 stays a word. Burst-file F1 90 → 97%.

The residual thinness is the model, not the tuning: one frame of features can't tell "loud and flat because burst" from "loud and flat because fricative". The fix is context — a model that sees ±5 frames — which is the top item in README "what I'd do next".

### Fixture note: speech levels

First real-speech fixtures normalised speech to −20 dBFS *peak*, which puts its RMS around −32 dB — the same as the noise. Every detector scored 0% on `speech-noisy`. A normal mic peaks near −6 dBFS; fixed to 0.5 peak. Wrong fixture levels make every detector look broken.

### 12. Live mode never turned off — real room silence is *tonal*

**Symptom (reported from a real Chrome session):** `/live` lit up SPEECH on the first word and never went back to silence. Offline, the learned detector called a 31 s recording of a real voice one continuous segment: `0.00–31.38`.

**Investigation:** features on the recording's silence frames: flatness 0.1–0.4, ZCR 0.02–0.08, energy 1–5 dB above floor. Low flatness + low ZCR is the fingerprint of *voiced speech* — and of a laptop fan. Spectrum of a silence frame: 56–79 % of energy below 100 Hz, peaking at 63 Hz, with harmonics at 156–313 Hz. The training data's silence had always been white noise (flat, high ZCR), so the model learned "tonal and low-crossing ⇒ speech" and every quiet frame in a real room passed.

Energy and spectral were fine on the same file — both have an energy gate.

**Fixes:**

1. **High-pass filter at 100 Hz** in front of every detector (`dsp/filter.ts`, second-order Butterworth). A first-order filter was tried first and barely dented 63 Hz. Standard front end in every practical VAD.
2. **Energy gate on the learned detector and the streaming detector** (enter +8 dB, exit +4 dB, hysteresis). The model now *refines* loud frames instead of overruling silence. This is the same architecture spectral already had, and it is the actual fix — the HPF alone didn't move flatness, because the room's fan harmonics are above 100 Hz.
3. **Room noise in the fixtures** (60 Hz hum + harmonics + brown rumble) so the model trains on tonal silence. After retraining, the energy weight went 0.70 → 1.24: the model learned loudness matters more than tonality.

**Result:** streaming on the real recording — longest continuous speech 1.7 s (was: the whole file), 93.5 % agreement with the offline spectral detector. All three offline detectors give ~19 near-identical phrase segments.

**Lesson:** synthetic silence is the most unrealistic part of synthetic audio. Real rooms hum.

### 13. Class imbalance after adding room noise

Retraining on the room-noise files fixed real silence but dropped the burst files to 82 % — bursts were ~150 of 8,800 frames, so the model stopped caring. Added burst-heavy fixtures (`many-bursts`, second bursts in two speech files). Bursts back to 97 % with real speech unchanged. Balance the classes; don't hand-edit the weights.

### Fixture bug: NaN silently became silence

Adding room noise to the speech generator produced files of pure zeros. `roomNoise()` expected a *uniform* random source and was given a *normal* one; `Math.log(1 − 1.7)` is NaN, `0 × NaN` is NaN, and the WAV encoder's clamp turned NaN into 0. Every detector scored 0 % on six files before the cause was found. A peak-amplitude sanity check on generated fixtures would have caught it in seconds.

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

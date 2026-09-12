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

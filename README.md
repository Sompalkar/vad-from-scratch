# vad-from-scratch

A Voice Activity Detector built from scratch in TypeScript, with a Next.js UI to visualise it.

Inspired by Sarvam AI's ML engineer screening task: build a VAD in 2.5 hours, judged on accuracy, code quality, and proposed improvements.

- `backend/` — WAV decoding, FFT, VAD detectors, evaluation, HTTP API (zero runtime deps)
- `frontend/` — Next.js + Tailwind app: upload audio, see detected speech regions
- `samples/` — synthetic labelled WAVs for testing

See [NOTES.md](NOTES.md) for the build log: decisions, problems hit, and how they were solved.

## Detectors

| name | idea |
|---|---|
| `energy` | frame dB above an adaptive noise-floor threshold |
| `spectral` | energy gate + low spectral flatness + energy concentrated in 300–3400 Hz |

## Run

Backend (port 4000):

```bash
cd backend && npm install && npm run samples && npm run dev
```

Frontend (port 3000):

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000, pick a sample or upload a WAV, switch detectors and compare.

Or hit the API directly:

```bash
curl -X POST "localhost:4000/vad?method=spectral" --data-binary @samples/with-noise-bursts.wav
```

`cd backend && npm test` runs the unit and API tests.

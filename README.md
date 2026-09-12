# vad-from-scratch

A Voice Activity Detector built from scratch in TypeScript, with a Next.js UI to visualise it.

Inspired by Sarvam AI's ML engineer screening task: build a VAD in 2.5 hours, judged on accuracy, code quality, and proposed improvements.

- `backend/` — audio decoding, VAD algorithms, evaluation, HTTP API
- `frontend/` — Next.js + Tailwind app: upload audio, see detected speech regions

See [NOTES.md](NOTES.md) for the build log: decisions, problems hit, and how they were solved.

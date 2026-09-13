const STEPS = [
  {
    title: "Slice",
    body: "Audio is cut into 30 ms windows, stepping 10 ms at a time. Every decision is made per window.",
  },
  {
    title: "Measure",
    body: "Each window gets four numbers: loudness above the room's noise floor, spectral flatness (voice is harmonic, noise is flat), how much energy sits in 100–4000 Hz, and how often the wave crosses zero.",
  },
  {
    title: "Decide",
    body: "Energy: is it loud? Spectral: loud and voice-shaped? Learned: a logistic regression trained on labelled audio weighs all four.",
  },
  {
    title: "Smooth",
    body: "Two thresholds (enter high, leave low) stop flicker; a 40 ms hangover keeps words whole; runs under 50 ms are dropped.",
  },
];

export function Explainer() {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-medium text-zinc-300">How it works</h2>
      <ol className="mt-3 grid gap-4 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="text-sm">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs text-zinc-400">
                {i + 1}
              </span>
              <span className="font-medium text-zinc-200">{s.title}</span>
            </div>
            <p className="text-zinc-400">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-zinc-500">
        No audio or ML libraries — WAV parser, FFT, filters and gradient descent are all in the repo. The build log of
        every wrong assumption is in{" "}
        <a
          className="text-zinc-300 underline decoration-zinc-700 hover:decoration-zinc-400"
          href="https://github.com/Sompalkar/vad-from-scratch/blob/main/NOTES.md"
          target="_blank"
          rel="noreferrer"
        >
          NOTES.md
        </a>
        .
      </p>
    </section>
  );
}

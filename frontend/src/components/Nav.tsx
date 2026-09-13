"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Analyse a file" },
  { href: "/live", label: "Live microphone" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
          VAD from scratch
        </Link>
        <div className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                path === l.href ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/Sompalkar/vad-from-scratch"
            target="_blank"
            rel="noreferrer"
            className="ml-2 rounded-md px-3 py-1.5 text-zinc-400 hover:text-zinc-100"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </nav>
  );
}

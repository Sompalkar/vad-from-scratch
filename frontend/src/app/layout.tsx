import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VAD from scratch",
  description: "Voice activity detection built from scratch in TypeScript — WAV parser, FFT, three detectors, live microphone mode.",
  openGraph: {
    title: "VAD from scratch",
    description: "Voice activity detection built from scratch in TypeScript. No audio or ML libraries.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Nav />
        <div className="flex-1">{children}</div>
        <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-xs text-zinc-600">
          Built as an answer to Sarvam AI&apos;s ML engineer screening task. Everything is open source.
        </footer>
      </body>
    </html>
  );
}

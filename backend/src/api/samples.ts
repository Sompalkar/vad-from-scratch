import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const SAMPLES_DIR = join(import.meta.dirname, "..", "..", "..", "samples");

export interface SampleInfo {
  name: string;
  hasLabels: boolean;
}

export async function listSamples(): Promise<SampleInfo[]> {
  const files = await readdir(SAMPLES_DIR).catch(() => [] as string[]);
  const wavs = files.filter((f) => f.endsWith(".wav"));
  return wavs.map((f) => {
    const name = basename(f, ".wav");
    return { name, hasLabels: files.includes(`${name}.json`) };
  });
}

/** Reads a sample by name. Rejects anything that isn't a bare filename. */
export function readSample(file: string): Promise<Buffer> {
  if (!/^[\w-]+\.(wav|json)$/.test(file)) {
    throw new Error("Invalid sample name");
  }
  return readFile(join(SAMPLES_DIR, file));
}

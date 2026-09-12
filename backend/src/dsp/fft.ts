/**
 * In-place iterative radix-2 FFT (Cooley–Tukey).
 *
 * Input length must be a power of two. Real signals are passed with a zero
 * imaginary part; the output is symmetric so callers only need bins 0..N/2.
 */

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) {
    throw new Error("FFT length must be a power of two");
  }

  // Bit-reversal permutation: reorder input so the butterflies below can
  // work in place.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }

  // Butterflies: combine DFTs of size len/2 into size len, doubling each pass.
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const bRe = (re[b] ?? 0) * curRe - (im[b] ?? 0) * curIm;
        const bIm = (re[b] ?? 0) * curIm + (im[b] ?? 0) * curRe;
        re[b] = (re[a] ?? 0) - bRe;
        im[b] = (im[a] ?? 0) - bIm;
        re[a] = (re[a] ?? 0) + bRe;
        im[a] = (im[a] ?? 0) + bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Smallest power of two >= n. */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Magnitude spectrum of a real frame: |X[k]| for k in 0..N/2.
 * The frame is Hann-windowed to reduce spectral leakage, then zero-padded.
 */
export function magnitudeSpectrum(frame: Float32Array): Float64Array {
  const n = nextPowerOfTwo(frame.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < frame.length; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame.length - 1)));
    re[i] = (frame[i] ?? 0) * hann;
  }
  fft(re, im);

  const bins = n / 2 + 1;
  const mag = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    mag[k] = Math.hypot(re[k] ?? 0, im[k] ?? 0);
  }
  return mag;
}

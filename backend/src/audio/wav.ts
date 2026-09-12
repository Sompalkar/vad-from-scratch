/**
 * Minimal WAV (RIFF) decoder.
 *
 * Supports PCM 8/16/24/32-bit integer and 32-bit float, mono or multi-channel.
 * Multi-channel audio is downmixed to mono by averaging, since VAD only cares
 * about "is there speech", not where it comes from.
 */

export interface PcmAudio {
  /** Mono samples normalised to [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
}

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"
const FMT = 0x666d7420; // "fmt "
const DATA = 0x64617461; // "data"

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;

export function decodeWav(input: ArrayBuffer | Uint8Array): PcmAudio {
  const view =
    input instanceof Uint8Array
      ? new DataView(input.buffer, input.byteOffset, input.byteLength)
      : new DataView(input);

  if (view.getUint32(0, false) !== RIFF || view.getUint32(8, false) !== WAVE) {
    throw new Error("Not a RIFF/WAVE file");
  }

  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  // Walk the chunk list. Each chunk is: 4-byte id, 4-byte size, payload.
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    const payload = offset + 8;

    if (id === FMT) {
      format = view.getUint16(payload, true);
      channels = view.getUint16(payload + 2, true);
      sampleRate = view.getUint32(payload + 4, true);
      bitsPerSample = view.getUint16(payload + 14, true);
      // WAVE_FORMAT_EXTENSIBLE stores the real format code in a sub-header.
      if (format === FORMAT_EXTENSIBLE && size >= 26) {
        format = view.getUint16(payload + 24, true);
      }
    } else if (id === DATA) {
      dataOffset = payload;
      dataLength = Math.min(size, view.byteLength - payload);
    }

    // Chunks are word-aligned: odd sizes carry one padding byte.
    offset = payload + size + (size & 1);
  }

  if (dataOffset < 0) throw new Error("WAV has no data chunk");
  if (channels === 0 || sampleRate === 0) throw new Error("WAV has no fmt chunk");
  if (format !== FORMAT_PCM && format !== FORMAT_FLOAT) {
    throw new Error(`Unsupported WAV format code ${format}`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);
  const readSample = sampleReader(view, format, bitsPerSample);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += readSample(dataOffset + (i * channels + c) * bytesPerSample);
    }
    samples[i] = sum / channels;
  }

  return { samples, sampleRate };
}

/** Returns a function that reads one normalised sample at a byte offset. */
function sampleReader(
  view: DataView,
  format: number,
  bits: number,
): (byteOffset: number) => number {
  if (format === FORMAT_FLOAT && bits === 32) {
    return (o) => view.getFloat32(o, true);
  }
  switch (bits) {
    case 8:
      // 8-bit WAV is unsigned, centred at 128.
      return (o) => (view.getUint8(o) - 128) / 128;
    case 16:
      return (o) => view.getInt16(o, true) / 32768;
    case 24:
      return (o) => {
        const b0 = view.getUint8(o);
        const b1 = view.getUint8(o + 1);
        const b2 = view.getInt8(o + 2); // sign lives in the top byte
        return ((b2 << 16) | (b1 << 8) | b0) / 8388608;
      };
    case 32:
      return (o) => view.getInt32(o, true) / 2147483648;
    default:
      throw new Error(`Unsupported bit depth ${bits}`);
  }
}

/** Encodes mono float samples as 16-bit PCM WAV. Used for tests and fixtures. */
export function encodeWav({ samples, sampleRate }: PcmAudio): ArrayBuffer {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  view.setUint32(0, RIFF, false);
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, WAVE, false);
  view.setUint32(12, FMT, false);
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, FORMAT_PCM, true);
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  view.setUint32(36, DATA, false);
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return buffer;
}

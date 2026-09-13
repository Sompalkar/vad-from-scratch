/**
 * AudioWorklet processor: forwards raw mono Float32 samples to the main
 * thread in ~1024-sample chunks. Runs on the audio thread, so keep it tiny.
 */
class PcmForwarder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(1024);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.chunk[this.filled++] = channel[i];
      if (this.filled === this.chunk.length) {
        this.port.postMessage(this.chunk.slice());
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-forwarder", PcmForwarder);

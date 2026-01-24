
export const CONFIG = {
  FRAME_RATE: 60,
  SAMPLE_RATE_IN: 16000,
  SAMPLE_RATE_OUT: 24000,
  MAX_BACKOFF_MS: 10000,
  VISUAL_MAX_DIMENSION: 1920,
  JPEG_QUALITY: 0.85,
  VAD_THRESHOLD: 0.005,
  VAD_HYSTERESIS_FRAMES: 40, // Corrigido typo (era hYSTERESIS)
  AUDIO_LATENCY_HINT: 'interactive' as AudioContextLatencyCategory,
};

export const WORKLET_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.index = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.index++] = channelData[i];
        if (this.index >= this.bufferSize) {
          this.port.postMessage(this.buffer);
          this.index = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('recorder-worklet', RecorderProcessor);
`;

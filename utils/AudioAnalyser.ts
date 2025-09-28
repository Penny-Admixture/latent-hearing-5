

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/** Simple class for getting the current audio level. */
export class AudioAnalyser extends EventTarget {
  readonly node: AnalyserNode;
  private readonly timeData: Uint8Array;
  private rafId: number | null = null;
  constructor(context: AudioContext) {
    super();
    this.node = context.createAnalyser();
    this.node.fftSize = 2048; // A good balance of detail and performance
    this.node.smoothingTimeConstant = 0.8;
    this.timeData = new Uint8Array(this.node.fftSize);
    this.loop = this.loop.bind(this);
  }
  
  getCurrentLevel() {
    // Calculate RMS for a more perceptually accurate volume level
    let sumSquares = 0.0;
    for (const amplitude of this.timeData) {
      // Convert 8-bit unsigned integer (0-255) to a signed float (-1.0 to 1.0)
      const value = (amplitude / 128.0) - 1.0;
      sumSquares += value * value;
    }
    const rms = Math.sqrt(sumSquares / this.timeData.length);
    // Scale up slightly for better visual feedback on knobs
    return Math.min(1.0, rms * 2.5);
  }

  loop() {
    this.rafId = requestAnimationFrame(this.loop);
    
    // Get waveform data for the visualizer
    this.node.getByteTimeDomainData(this.timeData);
    this.dispatchEvent(new CustomEvent('audio-data-changed', { detail: this.timeData }));

    // Calculate and dispatch overall level for knob animations
    const level = this.getCurrentLevel();
    this.dispatchEvent(new CustomEvent('audio-level-changed', { detail: level }));
  }

  start = this.loop;
  
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
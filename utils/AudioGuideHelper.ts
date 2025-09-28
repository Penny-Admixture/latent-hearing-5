/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Manages loading, analyzing, and playing an audio guide track.
 */
export class AudioGuideHelper extends EventTarget {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private beatIntervalId: number | null = null;
  public bpm: number | null = null;
  public isPlaying = false;

  constructor(audioContext: AudioContext) {
    super();
    this.audioContext = audioContext;
  }

  /**
   * Loads and decodes an audio file, then detects its BPM.
   * @param file The audio file to process.
   */
  public async loadFile(file: File): Promise<void> {
    this.stop();
    this.audioBuffer = null;
    this.bpm = null;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.bpm = await this.detectBPM(this.audioBuffer);
  }

  /**
   * A simplified BPM detection algorithm.
   * @param buffer The AudioBuffer to analyze.
   * @returns The detected BPM as a number.
   */
  private async detectBPM(buffer: AudioBuffer): Promise<number> {
    // A real-world implementation of BPM detection is more complex.
    // This simplified version looks for sharp increases in amplitude (onsets)
    // and finds the most common interval between them.
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate analysis time.
    
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const peaks: number[] = [];
    
    // Find peaks by looking for a sharp rise in amplitude (basic onset detection).
    for (let i = 1; i < data.length; i++) {
        if (data[i] - data[i-1] > 0.25) { // Threshold for onset detection
            peaks.push(i);
        }
    }
    
    if (peaks.length < 10) return 120; // Not enough data, default to 120

    // Group inter-onset intervals
    const intervalCounts: Record<string, number> = {};
    for (let i = 1; i < peaks.length; i++) {
        const interval = peaks[i] - peaks[i - 1];
        // Only consider intervals in a reasonable BPM range (40-200bpm)
        const tempo = 60 / (interval / sampleRate);
        if (tempo > 40 && tempo < 200) {
            // Group nearby intervals to account for slight timing variations
            const roundedInterval = Math.round(interval / 100) * 100; 
            intervalCounts[roundedInterval] = (intervalCounts[roundedInterval] || 0) + 1;
        }
    }
    
    if (Object.keys(intervalCounts).length === 0) return 120;
    
    // Find the most common interval group
    const mostCommonInterval = Object.keys(intervalCounts).sort((a,b) => intervalCounts[b] - intervalCounts[a])[0];
    
    const bpm = 60 / (parseInt(mostCommonInterval) / sampleRate);

    // Normalize BPM to a common musical range (e.g., 75-150)
    let finalBpm = bpm;
    while (finalBpm < 75) finalBpm *= 2;
    while (finalBpm > 150) finalBpm /= 2;

    return Math.round(finalBpm);
  }

  /**
   * Starts playing the loaded audio and emitting beat events.
   */
  public play(): void {
    if (this.isPlaying || !this.audioBuffer || !this.bpm) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.start();
    this.isPlaying = true;

    const beatIntervalMs = (60 / this.bpm) * 1000;
    let beatCount = 0;
    this.beatIntervalId = window.setInterval(() => {
      this.dispatchEvent(new CustomEvent('beat', { detail: { beat: (beatCount % 4) + 1 } }));
      beatCount++;
    }, beatIntervalMs);
    
    this.sourceNode.onended = () => {
        this.stop();
    };
  }

  /**
   * Stops audio playback and beat events.
   */
  public stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Can throw if already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.beatIntervalId) {
      clearInterval(this.beatIntervalId);
      this.beatIntervalId = null;
    }
    this.isPlaying = false;
  }
}

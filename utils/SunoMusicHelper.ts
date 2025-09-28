/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { IMusicGenerationService, PlaybackState, Prompt } from '../types';

/**
 * A stub implementation for a potential Suno integration.
 */
export class SunoMusicHelper extends EventTarget implements IMusicGenerationService {
  public readonly audioContext: AudioContext;
  public extraDestination: AudioNode | null = null;
  private playbackState: PlaybackState = 'stopped';

  constructor() {
    super();
    this.audioContext = new AudioContext();
    console.log('SunoMusicHelper initialized (stub).');
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(new CustomEvent('playback-state-changed', { detail: state }));
  }

  async playPause(): Promise<void> {
    const detail = 'Suno integration is not yet implemented.';
    console.error(detail);
    this.dispatchEvent(new CustomEvent('error', { detail }));

    // Toggle state for UI feedback and to prevent getting stuck.
    if (this.playbackState === 'playing' || this.playbackState === 'loading') {
      this.setPlaybackState('stopped');
    } else {
      // Pretend to load then stop.
      this.setPlaybackState('loading');
      setTimeout(() => this.setPlaybackState('stopped'), 1000);
    }
  }

  stop(): void {
    console.log('SunoMusicHelper stop called (stub).');
    this.setPlaybackState('stopped');
  }

  setWeightedPrompts(prompts: Map<string, Prompt>): void {
    const promptText = [...prompts.values()].filter(p => p.weight > 0).map(p => p.text).join(' ');
    console.log(`SunoMusicHelper received prompts (stub): ${promptText}`);
  }
}

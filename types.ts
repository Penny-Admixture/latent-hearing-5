
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface Prompt {
  readonly promptId: string;
  text: string;
  weight: number;
  cc: number;
  color: string;
}

export interface ControlChange {
  channel: number;
  cc: number;
  value: number;
}

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';

export type MusicServiceId = 'lyria' | 'suno' | 'udio';

export type ThemeId = 'metallic' | 'navy-olive' | 'maroon-gold' | 'periwinkle-lime' | 'gray-pink' | 'navy-gold';

export interface Theme {
  id: ThemeId;
  name: string;
}


/**
 * An interface for a music generation service.
 */
export interface IMusicGenerationService extends EventTarget {
  readonly audioContext: AudioContext;
  extraDestination: AudioNode | null;

  playPause(): Promise<void>;
  stop(): void;
  setWeightedPrompts(prompts: Map<string, Prompt>): void;
}

// This is a stripped down version of the original LiveMusicHelper that
// was causing issues with the live content.
// TODO: remove this and use the version from the SDK once it's fixed.
declare module '@google/genai' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface WeightedPrompt {}
  interface WeightedPromptRequest {
    weightedPrompts: WeightedPrompt[];
  }
  interface LiveMusicSession {
    setWeightedPrompts(request: WeightedPromptRequest): Promise<void>;
  }
}

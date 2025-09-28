

/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackState, Prompt, MusicServiceId, IMusicGenerationService } from './types';
import { GoogleGenAI, LiveMusicFilteredPrompt } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { SunoMusicHelper } from './utils/SunoMusicHelper';
import { UdioMusicHelper } from './utils/UdioMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';
import { PRESET_A } from './presets';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const lyriaModel = 'lyria-realtime-exp';

function buildInitialPrompts(): Map<string, Prompt> {
  const prompts = new Map<string, Prompt>();
  for (let i = 0; i < 36; i++) {
    const promptId = `prompt-${i}`;
    const prompt: Prompt = {
      promptId,
      text: PRESET_A[i] || '',
      weight: 0,
      cc: 20 + i,
      // Use a range of dark greens for a classier look
      color: `hsl(${120 + i * 2}, 60%, 30%)`,
    };
    prompts.set(promptId, prompt);
  }
  return prompts;
}

function main() {
  const initialPrompts = buildInitialPrompts();
  const initialScript = '';

  const pdjMidi = new PromptDjMidi(initialPrompts, initialScript);
  document.body.appendChild(pdjMidi);

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  let musicService: IMusicGenerationService = new LiveMusicHelper(ai, lyriaModel);
  let audioAnalyser = new AudioAnalyser(musicService.audioContext);
  musicService.extraDestination = audioAnalyser.node;
  
  function wireUpMusicService(service: IMusicGenerationService) {
    service.setWeightedPrompts(initialPrompts);

    service.addEventListener('playback-state-changed', ((e: Event) => {
      const customEvent = e as CustomEvent<PlaybackState>;
      const playbackState = customEvent.detail;
      pdjMidi.playbackState = playbackState;
      playbackState === 'playing' ? audioAnalyser.start() : audioAnalyser.stop();
    }));

    service.addEventListener('filtered-prompt', ((e: Event) => {
      const customEvent = e as CustomEvent<LiveMusicFilteredPrompt>;
      const filteredPrompt = customEvent.detail;
      if (filteredPrompt.text) {
        pdjMidi.addFilteredPrompt(filteredPrompt.text);
      }
    }));
    
    service.addEventListener('error', ((e: Event) => {
      const customEvent = e as CustomEvent<string>;
      toastMessage.show(customEvent.detail);
    }));
  }

  function switchMusicService(serviceId: MusicServiceId) {
    musicService.stop();
    audioAnalyser.stop();

    if (serviceId === 'lyria') {
      musicService = new LiveMusicHelper(ai, lyriaModel);
    } else if (serviceId === 'suno') {
      musicService = new SunoMusicHelper();
    } else if (serviceId === 'udio') {
      musicService = new UdioMusicHelper();
    }
    
    audioAnalyser = new AudioAnalyser(musicService.audioContext);
    musicService.extraDestination = audioAnalyser.node;
    wireUpMusicService(musicService);
  }

  wireUpMusicService(musicService);

  // Bind to UI events
  pdjMidi.addEventListener('prompts-changed', (e: Event) => {
    const customEvent = e as CustomEvent<Map<string, Prompt>>;
    musicService.setWeightedPrompts(customEvent.detail);
  });

  pdjMidi.addEventListener('play-pause', () => musicService.playPause());

  pdjMidi.addEventListener('error', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    toastMessage.show(customEvent.detail);
  });

  pdjMidi.addEventListener('music-service-changed', (e: Event) => {
    const customEvent = e as CustomEvent<MusicServiceId>;
    switchMusicService(customEvent.detail);
  });

  audioAnalyser.addEventListener('audio-level-changed', (e: Event) => {
    const customEvent = e as CustomEvent<number>;
    pdjMidi.audioLevel = customEvent.detail;
  });

  audioAnalyser.addEventListener('audio-data-changed', (e: Event) => {
    const customEvent = e as CustomEvent<Uint8Array>;
    pdjMidi.waveformData = customEvent.detail;
  });

  // Attempt to enable MIDI right away.
  pdjMidi.setShowMidi(true).catch(e => {
    toastMessage.show(e.message);
  });
}

main();

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
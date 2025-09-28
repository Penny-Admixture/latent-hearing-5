

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
import { AudioGuideHelper } from './utils/AudioGuideHelper';
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

  const audioGuideHelper = new AudioGuideHelper(new AudioContext());

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

  pdjMidi.addEventListener('play-pause', () => {
    musicService.playPause();

    const isPlayingOrLoading = pdjMidi.playbackState === 'playing' || pdjMidi.playbackState === 'loading';
    if (isPlayingOrLoading) {
      audioGuideHelper.stop();
    } else {
      audioGuideHelper.play();
    }
  });

  pdjMidi.addEventListener('error', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    toastMessage.show(customEvent.detail);
  });

  pdjMidi.addEventListener('music-service-changed', (e: Event) => {
    const customEvent = e as CustomEvent<MusicServiceId>;
    switchMusicService(customEvent.detail);
  });

  pdjMidi.addEventListener('guide-track-loaded', async (e: Event) => {
    const customEvent = e as CustomEvent<File>;
    const file = customEvent.detail;
    pdjMidi.guideTrackInfo = `Loading ${file.name}...`;
    try {
        await audioGuideHelper.loadFile(file);
        pdjMidi.guideTrackInfo = `${file.name} (${audioGuideHelper.bpm} BPM)`;
    } catch (err) {
        const message = `Error processing audio file: ${(err as Error).message}`;
        toastMessage.show(message);
        pdjMidi.guideTrackInfo = 'None';
    }
  });

  audioGuideHelper.addEventListener('beat', (e: Event) => {
    const customEvent = e as CustomEvent<{ beat: number }>;
    const { beat } = customEvent.detail;

    // On the first beat of a measure, 50% chance to trigger an action
    if (beat === 1 && Math.random() < 0.5) {
        // 50/50 chance between two actions
        if (Math.random() < 0.5) {
            pdjMidi.handleCategoryTheory();
        } else {
            pdjMidi.handleSparse();
        }
    }
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

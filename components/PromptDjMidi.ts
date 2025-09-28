



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';
import { ALL_PROMPTS } from '../prompts';
import { DICTIONARY } from '../dictionary';
import { PRESET_A, PRESET_B, PRESET_C, PRESET_D, PRESET_E, PRESET_F } from '../presets';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt, MusicServiceId, Theme, ThemeId } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';
import { THEMES } from '../themes';

const SCRIPT_MEASURE_DURATION_MS = 2000; // 1 measure = 2 seconds

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      box-sizing: border-box;
      position: relative;
      margin: 0 auto;
      width: 100vw;
      height: 100vh;

      background: var(--primary-bg-translucent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1.5vmin;
      transition: background-color 0.3s ease, border-color 0.3s ease;
      gap: 1.5vmin;
    }
    #version-display {
      position: absolute;
      top: 1.5vmin;
      right: 2vmin;
      font-family: monospace;
      font-size: 1.4vmin;
      color: var(--version-color); 
      opacity: 0.6;
      text-shadow: 0 0 5px var(--version-glow);
      pointer-events: none;
      z-index: 10;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -2;
      overflow: hidden;
    }
    #waveform-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    }
    #side-panel {
      display: flex;
      flex-direction: column;
      width: 300px;
      flex-shrink: 0;
      gap: 1.5vmin;
      overflow-y: hidden;
    }
    #main-content {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-width: 0;
      gap: 1.5vmin;
    }
    #grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1vmin 1.5vmin;
      flex-grow: 1;
    }
    prompt-controller {
      width: 100%;
    }
    #current-prompt-display {
      color: var(--primary-fg);
      font-size: 1.6vmin;
      text-align: center;
      margin: 0;
      padding: 1vmin;
      background: var(--bg-color-translucent);
      border-radius: 8px;
      width: 100%;
      height: 6vh;
      line-height: 1.4;
      max-height: 10vh;
      overflow-y: auto;
      word-break: break-word;
      box-sizing: border-box;
      border: 1px solid var(--container-border);
      flex-shrink: 0;
    }
    #buttons, #presets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5vmin;
      align-items: stretch;
      width: 100%;
    }
    #presets {
      grid-template-columns: repeat(6, 1fr);
      gap: 1vmin;
    }
    #presets button {
      font-size: 1.6vmin;
      padding: 2px;
      height: 3.5vmin;
      min-height: 24px;
    }
    #buttons > select {
      grid-column: 1 / -1;
    }
    button, select, play-pause-button {
      font: inherit;
      font-size: 1.4vmin;
      font-weight: 500;
      cursor: pointer;
      color: var(--button-fg);
      background: var(--button-bg);
      -webkit-font-smoothing: antialiased;
      border: 1px solid var(--button-border);
      border-radius: 6px;
      user-select: none;
      padding: 6px 8px;
      transition: all 0.2s ease-in-out;
      box-shadow: var(--button-shadow);
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 4.5vmin;
      min-height: 30px;
      box-sizing: border-box;
    }
    button:hover, select:hover, play-pause-button:hover {
      border-color: var(--button-hover-border);
      background: var(--button-hover-bg);
    }
    button.active {
      background: var(--button-active-bg);
      color: var(--button-active-fg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
    }
    select {
      padding: 6px 4px;
      outline: none;
    }
    select option {
      background: var(--bg-color);
      color: var(--primary-fg);
    }
    #script-editor {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1vmin;
    }
    #script-editor textarea {
      font-family: monospace;
      font-size: 1.8vmin;
      background: var(--bg-color-translucent);
      color: var(--primary-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      padding: 10px;
      height: 20vmin;
      min-height: 100px;
      resize: vertical;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    #script-editor textarea:focus {
      border-color: var(--accent-color);
    }
    #script-editor button {
      align-self: flex-start;
      padding: 5px 10px;
    }

    @media (max-width: 800px) {
      #grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 2.5vmin;
      }
    }
    @media (max-width: 480px) {
      #grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 4vmin;
      }
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;
  private scriptIntervalId: number | null = null;
  private glitchRafId: number | null = null;
  private driftIntervalId: number | null = null;
  private sparseTimeoutId: number | null = null;
  private autoSaveThrottled: () => void;
  private waveformCanvasContext: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver;


  @state() private showMidi = false;
  @state() private showScriptEditor = false;
  @state() private isGlitchModeActive = false;
  @state() private driftMode: 'none' | 'normal' | 'fast' | 'slow' = 'none';
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @property({ type: Object }) public waveformData: Uint8Array | null = null;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private allPrompts: string[] = [...ALL_PROMPTS];
  @state() private script = '';
  @state() private isScriptPlaying = false;
  @state() private scriptPlaybackPending = false;
  @state() private currentScriptLine = 0;
  @state() private musicService: MusicServiceId = 'lyria';
  @state() private activeTheme: ThemeId = 'navy-olive';
  @state() private version = 'latent_hearing_build_20250816_5';


  @query('#file-loader') private fileInput!: HTMLInputElement;
  @query('#waveform-canvas') private waveformCanvas!: HTMLCanvasElement;


  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  constructor(
    initialPrompts: Map<string, Prompt>,
    initialScript: string
  ) {
    super();
    this.prompts = initialPrompts;
    this.script = initialScript;
    this.midiDispatcher = new MidiDispatcher();
    this.glitchLoop = this.glitchLoop.bind(this);
    this.drawWaveform = this.drawWaveform.bind(this);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    // Auto-save state to a file, throttled to once per second.
    this.autoSaveThrottled = throttle(() => this.saveStateToFile(), 2000);
  }
  
  override connectedCallback() {
    super.connectedCallback();
    this.applyTheme(this.activeTheme);
    this.resizeObserver.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopGlitchEffect();
    this.stopScript();
    this.stopDrift();
    this.resizeObserver.disconnect();
  }
  
  override firstUpdated() {
    this.waveformCanvasContext = this.waveformCanvas.getContext('2d');
    this.handleResize();
  }

  private handleResize() {
    this.waveformCanvas.width = this.waveformCanvas.offsetWidth * window.devicePixelRatio;
    this.waveformCanvas.height = this.waveformCanvas.offsetHeight * window.devicePixelRatio;
  }

  override update(changedProperties: Map<string, unknown>) {
    super.update(changedProperties);
    if (changedProperties.has('playbackState') && this.playbackState === 'playing' && this.scriptPlaybackPending) {
      this.scriptPlaybackPending = false;
      this._startScriptInterval();
    }
    if (changedProperties.has('waveformData') && this.waveformData) {
      this.drawWaveform();
    }
  }

  private saveStateToFile() {
    const state = {
      prompts: Array.from(this.prompts.entries()),
      allPrompts: this.allPrompts,
      script: this.script,
      theme: this.activeTheme,
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `prompt-dj-state-${this.version}-${timestamp}.json`;
    
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  public getPrompts(): Map<string, Prompt> {
    return this.prompts;
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight, cc } = e.detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) {
      console.error('prompt not found', promptId);
      return;
    }

    // If the text has changed, it's no longer the same (filtered) prompt.
    if (prompt.text !== text) {
      this.filteredPrompts.delete(prompt.text);
    }

    if (text && !this.allPrompts.includes(text)) {
      this.allPrompts = [...this.allPrompts, text].sort();
    }

    prompt.text = text;
    prompt.weight = weight;
    prompt.cc = cc;

    const newPrompts = new Map(this.prompts);
    newPrompts.set(promptId, prompt);

    this.prompts = newPrompts;
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
    this.autoSaveThrottled();
  }

  /** Generates radial gradients for each prompt based on weight and color. */
  private readonly makeBackground = throttle(
    () => {
      // For Sandalwood theme, we want a solid black background.
      if (this.activeTheme === 'navy-olive') {
        return '';
      }
      const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

      const MAX_WEIGHT = 0.5;
      const MAX_ALPHA = 0.6;
      const NUM_COLS = 4;
      const NUM_ROWS = 9;

      const bg: string[] = [];

      [...this.prompts.values()].forEach((p, i) => {
        const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
        const alpha = Math.round(alphaPct * 0xff)
          .toString(16)
          .padStart(2, '0');

        const stop = p.weight / 2;
        const x = (i % NUM_COLS) / (NUM_COLS - 1);
        const y = Math.floor(i / NUM_COLS) / (NUM_ROWS - 1);
        const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;

        bg.push(s);
      });

      return bg.join(', ');
    },
    30, // don't re-render more than once every XXms
  );

  private toggleShowMidi() {
    return this.setShowMidi(!this.showMidi);
  }

  public async setShowMidi(show: boolean) {
    this.showMidi = show;
    if (!this.showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e) {
      this.dispatchEvent(new CustomEvent('error', {detail: (e as Error).message}));
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  private handleSave() {
    this.saveStateToFile();
  }
  
  private handleLoad(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const state = JSON.parse(event.target?.result as string);
        if (state.prompts && Array.isArray(state.prompts) && 
            state.allPrompts && Array.isArray(state.allPrompts)) {
          this.prompts = new Map(state.prompts);
          this.allPrompts = state.allPrompts;
          this.script = state.script || '';
          this.activeTheme = state.theme || 'metallic';
          this.applyTheme(this.activeTheme);
          this.dispatchEvent(
            new CustomEvent('prompts-changed', { detail: this.prompts }),
          );
          this.requestUpdate('prompts');
          this.autoSaveThrottled();
        } else {
          throw new Error('Invalid state file format.');
        }
      } catch (err) {
        this.dispatchEvent(new CustomEvent('error', {detail: (err as Error).message}));
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be loaded again.
    input.value = '';
  }
  
  private triggerLoad() {
    this.fileInput.click();
  }

  private handlePresetClick(presetPrompts: string[]) {
    const inactivePrompts = [...this.prompts.values()].filter(p => p.weight === 0);
    if (inactivePrompts.length === 0) {
        this.dispatchEvent(new CustomEvent('error', { detail: 'Deactivate some knobs to morph presets.' }));
        return;
    }

    // Shuffle and select half of the inactive prompts to change
    const shuffledInactive = inactivePrompts.sort(() => 0.5 - Math.random());
    const numToChange = Math.ceil(shuffledInactive.length / 2);
    const promptsToChange = shuffledInactive.slice(0, numToChange);

    // Get a pool of new prompts from the preset that aren't already on the board
    const currentPromptTexts = new Set([...this.prompts.values()].map(p => p.text));
    const availablePresetPrompts = presetPrompts.filter(p => p && !currentPromptTexts.has(p));
    
    if (availablePresetPrompts.length === 0) {
        this.dispatchEvent(new CustomEvent('error', { detail: 'No new unique prompts in this preset to add.' }));
        return;
    }

    const shuffledPreset = availablePresetPrompts.sort(() => 0.5 - Math.random());
    
    const newPrompts = new Map(this.prompts);
    const newLabelsToAdd: string[] = [];

    promptsToChange.forEach((promptToUpdate, index) => {
        // Cycle through available preset prompts if we don't have enough unique ones
        const newText = shuffledPreset[index % shuffledPreset.length];
        if (newText) {
            const originalPrompt = newPrompts.get(promptToUpdate.promptId)!;
            originalPrompt.text = newText;
            if (!this.allPrompts.includes(newText)) {
                newLabelsToAdd.push(newText);
            }
        }
    });

    if (newLabelsToAdd.length > 0) {
        this.allPrompts = [...this.allPrompts, ...newLabelsToAdd].sort();
    }

    this.prompts = newPrompts;
    
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
    this.requestUpdate();
    this.autoSaveThrottled();
  }

  private toggleScriptEditor() {
    this.showScriptEditor = !this.showScriptEditor;
    this.requestUpdate();
  }
  
  private handleScriptInput(e: Event) {
    this.script = (e.target as HTMLTextAreaElement).value;
    this.autoSaveThrottled();
  }

  private tickScript() {
    const lines = this.script.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      this.stopScript();
      return;
    }

    // Loop script by taking the next line index modulo the number of lines
    this.currentScriptLine = (this.currentScriptLine + 1) % lines.length;

    const line = lines[this.currentScriptLine];
    const values = line.split(',').map(v => parseInt(v.trim(), 10));

    const expectedLength = this.prompts.size;
    if (values.length !== expectedLength || values.some(isNaN)) {
      this.dispatchEvent(new CustomEvent('error', { detail: `Script error on line ${this.currentScriptLine + 1}: Must be ${expectedLength} comma-separated numbers (0-127).` }));
      this.stopScript();
      return;
    }

    const newPrompts = new Map(this.prompts);
    const promptArray = [...newPrompts.values()];

    values.forEach((value, index) => {
      if (index < promptArray.length) {
        const prompt = promptArray[index];
        // Convert 0-127 MIDI value to 0-2 weight
        prompt.weight = (Math.max(0, Math.min(127, value)) / 127) * 2;
        newPrompts.set(prompt.promptId, prompt);
      }
    });

    this.prompts = newPrompts;
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
    // No need to autosave here, as script playback is transient.
    this.requestUpdate();
  }

  private _startScriptInterval() {
    const lines = this.script.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        this.dispatchEvent(new CustomEvent('error', { detail: 'Script is empty.' }));
        return;
    }

    this.isScriptPlaying = true;
    this.currentScriptLine = -1; // Will be incremented to 0 on first tick
    this.tickScript(); // Run first line immediately
    this.scriptIntervalId = window.setInterval(() => this.tickScript(), SCRIPT_MEASURE_DURATION_MS);
    this.requestUpdate();
  }

  private stopScript() {
    if (this.scriptIntervalId) {
      clearInterval(this.scriptIntervalId);
      this.scriptIntervalId = null;
    }
    this.isScriptPlaying = false;
    this.scriptPlaybackPending = false;
    this.requestUpdate();
  }

  private toggleScriptPlayback() {
    if (this.isScriptPlaying || this.scriptPlaybackPending) {
        this.stopScript();
    } else {
        if (this.playbackState === 'playing') {
            this._startScriptInterval();
        } else {
            this.scriptPlaybackPending = true;
            this.playPause();
            this.requestUpdate();
        }
    }
  }

  private handleRandomize() {
    // 1. Randomize prompts and weights
    const newPrompts = new Map<string, Prompt>();
    const shuffled = [...ALL_PROMPTS].sort(() => 0.5 - Math.random());

    [...this.prompts.values()].forEach((p, i) => {
        const newPrompt: Prompt = {
            ...p, // keep id, cc, color
            text: shuffled[i],
            weight: Math.random() * 2,
        };
        newPrompts.set(p.promptId, newPrompt);
    });
    this.prompts = newPrompts;
    this.filteredPrompts.clear();
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));

    // 2. Generate random script
    const scriptLines = [];
    for (let i = 0; i < 16; i++) {
        const lineValues = [];
        for (let j = 0; j < this.prompts.size; j++) {
            lineValues.push(Math.floor(Math.random() * 128));
        }
        scriptLines.push(lineValues.join(', '));
    }
    this.script = scriptLines.join('\n');
    
    this.requestUpdate();
    this.autoSaveThrottled();
  }

  private generateFourWordLabel(): string {
    const words = [];
    for (let i = 0; i < 4; i++) {
        const word = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
        words.push(this.capitalize(word));
    }
    return words.join(' ');
  }

  private handleRandom2() {
    const newPrompts = new Map<string, Prompt>();
    const newLabelsToAdd: string[] = [];

    [...this.prompts.values()].forEach(p => {
      const newLabel = this.generateFourWordLabel();
      const newPrompt: Prompt = {
        ...p, // keep id, cc, color
        text: newLabel,
        weight: Math.random() * 2,
      };
      newPrompts.set(p.promptId, newPrompt);
      if (!this.allPrompts.includes(newLabel)) {
          newLabelsToAdd.push(newLabel);
      }
    });

    if (newLabelsToAdd.length > 0) {
      this.allPrompts = [...this.allPrompts, ...newLabelsToAdd].sort();
    }

    this.prompts = newPrompts;
    this.filteredPrompts.clear();
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
    this.requestUpdate();
    this.autoSaveThrottled();
  }

  private handleSparse() {
    const activePrompts = [...this.prompts.values()].filter(p => p.weight > 0);
    
    // Shuffle the active prompts
    for (let i = activePrompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activePrompts[i], activePrompts[j]] = [activePrompts[j], activePrompts[i]];
    }

    const promptsToDeactivate = activePrompts.slice(0, Math.floor(activePrompts.length / 2));
    
    if (promptsToDeactivate.length === 0 && this.prompts.size > 0) {
      // If no prompts are active, activate a random one instead of doing nothing.
      const allPromptIds = [...this.prompts.keys()];
      const randomPromptId = allPromptIds[Math.floor(Math.random() * allPromptIds.length)];
      promptsToDeactivate.push(this.prompts.get(randomPromptId)!);
    } else if (promptsToDeactivate.length === 0) {
        return; // No prompts to act on
    }


    const newPrompts = new Map(this.prompts);
    promptsToDeactivate.forEach(p => {
      const promptToUpdate = newPrompts.get(p.promptId);
      if (promptToUpdate) {
        promptToUpdate.weight = 0;
        newPrompts.set(p.promptId, promptToUpdate);
      }
    });

    this.prompts = newPrompts;
    
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );

    this.requestUpdate();
    this.autoSaveThrottled();
  }

  private capitalize(s: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private generateRandomLabel(): string {
    const word1 = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
    const word2 = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
    return `${this.capitalize(word1)} ${this.capitalize(word2)}`;
  }

  private handleCategoryTheory() {
    const activePrompts = [...this.prompts.values()].filter(p => p.weight > 0);

    // Shuffle active prompts to randomize which ones are changed
    for (let i = activePrompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activePrompts[i], activePrompts[j]] = [activePrompts[j], activePrompts[i]];
    }

    const promptsToChangeCount = Math.floor(activePrompts.length / 2);
    const promptsToChange = activePrompts.slice(0, promptsToChangeCount);

    if (promptsToChange.length === 0) {
      this.dispatchEvent(new CustomEvent('error', { detail: 'Activate some prompts first to use Category Theory.' }));
      return;
    }

    const newPrompts = new Map(this.prompts);
    const newLabelsToAdd: string[] = [];
    promptsToChange.forEach(p => {
      const promptToUpdate = newPrompts.get(p.promptId);
      if (promptToUpdate) {
        const newLabel = this.generateRandomLabel();
        promptToUpdate.text = newLabel;
        newPrompts.set(p.promptId, promptToUpdate);
        if (!this.allPrompts.includes(newLabel)) {
            newLabelsToAdd.push(newLabel);
        }
      }
    });

    if (newLabelsToAdd.length > 0) {
      this.allPrompts = [...this.allPrompts, ...newLabelsToAdd].sort();
    }

    this.prompts = newPrompts;

    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );

    this.requestUpdate();
    this.autoSaveThrottled();
  }
  
  private toggleGlitchMode() {
    this.isGlitchModeActive = !this.isGlitchModeActive;
    if (this.isGlitchModeActive) {
      this.startGlitchEffect();
    } else {
      this.stopGlitchEffect();
    }
  }
  
  private startGlitchEffect() {
    if (this.glitchRafId !== null) return;
    document.body.classList.add('glitch-active');
    this.glitchLoop();
  }

  private stopGlitchEffect() {
    if (this.glitchRafId !== null) {
      cancelAnimationFrame(this.glitchRafId);
      this.glitchRafId = null;
    }
    document.body.classList.remove('glitch-active');
    // Reset colors
    const newPrompts = new Map(this.prompts);
    [...newPrompts.values()].forEach((p, i) => {
        const originalColor = `hsl(${Math.round(i * (360 / 18))}, 90%, 65%)`;
        const promptToUpdate = newPrompts.get(p.promptId);
        if(promptToUpdate) {
            promptToUpdate.color = originalColor;
            newPrompts.set(p.promptId, promptToUpdate);
        }
    });
    this.prompts = newPrompts;
    
    this.requestUpdate();
  }

  private glitchLoop() {
    if (!this.isGlitchModeActive) return;

    const time = Date.now() * 0.05;
    
    // Update knob colors
    const newPrompts = new Map(this.prompts);
    [...newPrompts.values()].forEach((p, i) => {
      const promptToUpdate = newPrompts.get(p.promptId);
      if (promptToUpdate) {
          const knobHue = (time + i * 40) % 360;
          promptToUpdate.color = `hsl(${knobHue}, 90%, 65%)`;
          newPrompts.set(p.promptId, promptToUpdate);
      }
    });
    this.prompts = newPrompts;

    this.requestUpdate();

    this.glitchRafId = requestAnimationFrame(this.glitchLoop);
  }

  private toggleDriftMode(mode: 'normal' | 'fast' | 'slow') {
    // If clicking the currently active mode, turn it off. Otherwise, switch to the new mode.
    const newMode = this.driftMode === mode ? 'none' : mode;
    
    this.stopDrift(); // Always stop the current timers.

    this.driftMode = newMode;
    
    if (this.driftMode !== 'none') {
      this.startDrift(this.driftMode);
    }
    
    this.requestUpdate();
  }

  private driftSequence() {
    this.handleRandomize();
    // Use timeout to allow UI to update between rapid changes
    setTimeout(() => this.handleRandom2(), 100);
    setTimeout(() => this.handleCategoryTheory(), 200);
    setTimeout(() => this.handleSparse(), 300);
  }

  private startDrift(mode: 'normal' | 'fast' | 'slow') {
    let interval = 30000; // Default to 'normal'
    if (mode === 'fast') {
      interval = 15000;
    } else if (mode === 'slow') {
      interval = 60000;
    }
  
    this.driftSequence(); // Run once immediately
    this.driftIntervalId = window.setInterval(() => this.driftSequence(), interval);
    this.scheduleNextSparse();
  }

  private stopDrift() {
    if (this.driftIntervalId) {
        clearInterval(this.driftIntervalId);
        this.driftIntervalId = null;
    }
    if (this.sparseTimeoutId) {
        clearTimeout(this.sparseTimeoutId);
        this.sparseTimeoutId = null;
    }
  }

  private scheduleNextSparse() {
    if (this.driftMode === 'none') return;
    
    // Random interval between 5 and 25 seconds
    const randomInterval = 5000 + Math.random() * 20000;
    this.sparseTimeoutId = window.setTimeout(() => {
        this.handleSparse();
        this.scheduleNextSparse(); // Schedule the next one
    }, randomInterval);
  }

  private handleMusicServiceChange(e: Event) {
    this.musicService = (e.target as HTMLSelectElement).value as MusicServiceId;
    this.dispatchEvent(new CustomEvent('music-service-changed', {
        detail: this.musicService,
        bubbles: true,
        composed: true,
    }));
  }

  private applyTheme(themeId: ThemeId) {
    document.body.className = `theme-${themeId}`;
  }

  private handleThemeChange(e: Event) {
    const newTheme = (e.target as HTMLSelectElement).value as ThemeId;
    this.activeTheme = newTheme;
    this.applyTheme(newTheme);
    this.autoSaveThrottled();
  }

  private handleReverse() {
    const promptArray = Array.from(this.prompts.values());
    const movingData = promptArray.map(p => ({ text: p.text, weight: p.weight }));
    movingData.reverse();

    const newPrompts = new Map(this.prompts);
    let i = 0;
    for (const prompt of newPrompts.values()) {
        prompt.text = movingData[i].text;
        prompt.weight = movingData[i].weight;
        i++;
    }

    this.prompts = newPrompts;
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
    this.requestUpdate();
    this.autoSaveThrottled();
  }

  private handleScramble() {
      const promptArray = Array.from(this.prompts.values());
      const movingData = promptArray.map(p => ({ text: p.text, weight: p.weight }));

      // Fisher-Yates shuffle
      for (let i = movingData.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [movingData[i], movingData[j]] = [movingData[j], movingData[i]];
      }
      
      const newPrompts = new Map(this.prompts);
      let i = 0;
      for (const prompt of newPrompts.values()) {
          prompt.text = movingData[i].text;
          prompt.weight = movingData[i].weight;
          i++;
      }

      this.prompts = newPrompts;
      this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
      this.requestUpdate();
      this.autoSaveThrottled();
  }
  
  private drawWaveform() {
    if (!this.waveformCanvasContext || !this.waveformData) return;
    requestAnimationFrame(() => {
      const ctx = this.waveformCanvasContext!;
      const dataArray = this.waveformData!;
      const { width, height } = this.waveformCanvas;
      
      ctx.clearRect(0, 0, width, height);

      // Set styles from CSS variables for theming
      const themeColor = getComputedStyle(this).getPropertyValue('--primary-fg-dim').trim();
      ctx.lineWidth = 2 * window.devicePixelRatio;
      ctx.strokeStyle = themeColor;
      
      ctx.beginPath();
      
      const sliceWidth = width * 1.0 / dataArray.length;
      let x = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    });
  }

  private get currentPromptText() {
    const activePrompts = [...this.prompts.values()]
      .filter((p) => p.weight > 0)
      .map((p) => p.text)
      .join(' ');
    
    return activePrompts || '4 to teh floor';
  }

  override render() {
    const bg = styleMap({
      backgroundImage: this.makeBackground(),
    });
    return html`
      <div id="version-display">${this.version}</div>
      <div id="background" style=${bg}></div>
      <canvas id="waveform-canvas"></canvas>

      <div id="side-panel">
        <div id="buttons">
          <button
            style="--animation-order: 1"
            @click=${this.toggleShowMidi}
            class=${this.showMidi ? 'active' : ''}
            >MIDI</button
          >
          <play-pause-button style="--animation-order: 2" .playbackState=${this.playbackState} @click=${this.playPause}></play-pause-button>
          <button style="--animation-order: 3" @click=${this.handleSave}>Save</button>
          <button style="--animation-order: 4" @click=${this.triggerLoad}>Load</button>
          <input id="file-loader" type="file" accept=".json" style="display: none;" @change=${this.handleLoad}>
          
          <button style="--animation-order: 5" @click=${this.handleReverse}>Reverse</button>
          <button style="--animation-order: 6" @click=${this.handleScramble}>Scramble</button>
          <button 
            style="--animation-order: 7"
            @click=${this.toggleScriptEditor}
            class=${this.showScriptEditor ? 'active' : ''}
          >Script</button>
          <button style="--animation-order: 8" @click=${this.handleRandomize}>Randomize</button>
          <button style="--animation-order: 9" @click=${this.handleRandom2}>Random2</button>
          <button style="--animation-order: 10" @click=${this.handleSparse}>Sparse</button>
          <button style="--animation-order: 11" @click=${this.handleCategoryTheory}>Category Theory</button>
          <button style="--animation-order: 12" @click=${this.toggleGlitchMode} class=${this.isGlitchModeActive ? 'active' : ''}>Glitch</button>
          <button style="--animation-order: 13" @click=${() => this.toggleDriftMode('normal')} class=${this.driftMode === 'normal' ? 'active' : ''}>Drift</button>
          <button style="--animation-order: 14" @click=${() => this.toggleDriftMode('fast')} class=${this.driftMode === 'fast' ? 'active' : ''}>DriftFast</button>
          <button style="--animation-order: 15" @click=${() => this.toggleDriftMode('slow')} class=${this.driftMode === 'slow' ? 'active' : ''}>DriftSlow</button>
          
          ${this.showMidi ? html`<select
            style="--animation-order: 16"
            @change=${this.handleMidiInputChange}
            .value=${this.activeMidiInputId || ''}>
            ${this.midiInputIds.length > 0
          ? this.midiInputIds.map(
            (id) =>
              html`<option value=${id}>
                      ${this.midiDispatcher.getDeviceName(id)}
                    </option>`,
          )
          : html`<option value="">No devices found</option>`}
          </select>` : ''}
          <select
            style="--animation-order: 17"
            @change=${this.handleMusicServiceChange}
            .value=${this.musicService}
            title="Select Music Generation Service"
          >
            <option value="lyria">Lyria</option>
            <option value="suno">Suno</option>
            <option value="udio">Udio</option>
          </select>
          <select style="--animation-order: 18" @change=${this.handleThemeChange} title="Select Theme">
            ${Object.entries(THEMES).map(([id, theme]) => html`<option value=${id} ?selected=${id === this.activeTheme}>${theme.name}</option>`)}
          </select>
        </div>
        <div id="presets">
          <button @click=${() => this.handlePresetClick(PRESET_A)}>A</button>
          <button @click=${() => this.handlePresetClick(PRESET_B)}>B</button>
          <button @click=${() => this.handlePresetClick(PRESET_C)}>C</button>
          <button @click=${() => this.handlePresetClick(PRESET_D)}>D</button>
          <button @click=${() => this.handlePresetClick(PRESET_E)}>E</button>
          <button @click=${() => this.handlePresetClick(PRESET_F)}>F</button>
        </div>
      </div>
      <div id="main-content">
        <div id="grid">${this.renderPrompts()}</div>
        ${this.showScriptEditor ? this.renderScriptEditor() : ''}
        <div id="current-prompt-display">
          ${this.currentPromptText}
        </div>
      </div>
      `;
  }

  private renderScriptEditor() {
    const buttonText = (this.isScriptPlaying || this.scriptPlaybackPending) ? 'Stop Script' : 'Play Script';
    return html`
      <div id="script-editor">
        <textarea
          .value=${this.script}
          @input=${this.handleScriptInput}
          placeholder="Enter script: 36 values (0-127) per line, comma-separated. Each line is one measure (2 seconds)."
          ?disabled=${this.isScriptPlaying || this.scriptPlaybackPending}
        ></textarea>
        <button @click=${this.toggleScriptPlayback}>
          ${buttonText}
        </button>
      </div>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      const isScriptMode = this.isScriptPlaying || this.scriptPlaybackPending;
      return html`<prompt-controller
        .allPrompts=${this.allPrompts}
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        ?scriptModeActive=${isScriptMode}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}
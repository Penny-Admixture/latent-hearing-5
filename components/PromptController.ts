/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import './WeightKnob';
import type { WeightKnob } from './WeightKnob';

import type { MidiDispatcher } from '../utils/MidiDispatcher';
import type { Prompt, ControlChange } from '../types';

/** A single prompt input associated with a MIDI CC. */
@customElement('prompt-controller')
// FIX: The class must extend LitElement to be a custom element.
export class PromptController extends LitElement {
  static override styles = css`
    .prompt {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 1.5vmin;
    }
    weight-knob {
      width: 7vmin;
      height: 7vmin;
      min-width: 40px;
      min-height: 40px;
      flex-shrink: 0;
    }
    .label-container {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }
    #midi {
      font-family: monospace;
      text-align: left;
      font-size: 1.5vmin;
      border: 0.2vmin solid var(--primary-fg-dim);
      border-radius: 0.5vmin;
      padding: 1px 5px;
      color: var(--primary-fg-dim);
      background: var(--bg-color-translucent);
      cursor: pointer;
      visibility: hidden;
      user-select: none;
      margin-top: 0.3vmin;
      display: inline-block;
      .learn-mode & {
        color: orange;
        border-color: orange;
      }
      .show-cc & {
        visibility: visible;
      }
    }
    .prompt-input {
      font-family: inherit;
      box-sizing: border-box;
      font-weight: 500;
      font-size: 1.8vmin;
      width: 100%;
      padding: 0.1em 0.3em;
      border-radius: 4px;
      text-align: left;
      outline: none;
      -webkit-font-smoothing: antialiased;
      cursor: text;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      box-shadow: var(--input-shadow);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([filtered]) {
      weight-knob { 
        opacity: 0.5;
      }
      .prompt-input {
        background: #da2000;
        z-index: 1;
      }
    }
  `;

  @property({ type: String }) promptId = '';
  @property({ type: String }) text = '';
  @property({ type: Number }) weight = 0;
  @property({ type: String }) color = '';
  @property({ type: Boolean, reflect: true }) filtered = false;

  @property({ type: Number }) cc = 0;
  @property({ type: Number }) channel = 0; // Not currently used

  @property({ type: Boolean }) learnMode = false;
  @property({ type: Boolean }) showCC = false;
  @property({ type: Boolean }) scriptModeActive = false;

  @property({ type: Array }) allPrompts: string[] = [];

  @query('weight-knob') private weightInput!: WeightKnob;

  @property({ type: Object })
  midiDispatcher: MidiDispatcher | null = null;

  @property({ type: Number }) audioLevel = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.midiDispatcher?.addEventListener('cc-message', (e: Event) => {
      if (this.scriptModeActive) return;

      const customEvent = e as CustomEvent<ControlChange>;
      const { channel, cc, value } = customEvent.detail;
      if (this.learnMode) {
        this.cc = cc;
        this.channel = channel;
        this.learnMode = false;
        this.dispatchPromptChange();
      } else if (cc === this.cc) {
        this.weight = (value / 127) * 2;
        this.dispatchPromptChange();
      }
    });
  }

  override update(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('showCC') && !this.showCC) {
      this.learnMode = false;
    }
    super.update(changedProperties);
  }

  private dispatchPromptChange() {
    this.dispatchEvent(
      new CustomEvent<Prompt>('prompt-changed', {
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          cc: this.cc,
          color: this.color,
        },
      }),
    );
  }

  private handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.text = input.value;
    this.dispatchPromptChange();
  }
  
  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchPromptChange();
  }

  private toggleLearnMode() {
    this.learnMode = !this.learnMode;
  }

  override render() {
    const classes = classMap({
      'prompt': true,
      'learn-mode': this.learnMode,
      'show-cc': this.showCC,
    });
    const datalistId = `prompt-list-${this.promptId}`;

    return html`<div class=${classes}>
      <weight-knob
        id="weight"
        value=${this.weight}
        color=${this.filtered ? '#888' : this.color}
        audioLevel=${this.filtered ? 0 : this.audioLevel}
        ?disabled=${this.scriptModeActive}
        @input=${this.updateWeight}></weight-knob>
      <div class="label-container">
        <input
          class="prompt-input"
          type="text"
          list=${datalistId}
          .value=${this.text}
          @input=${this.handleInputChange}
          ?disabled=${this.scriptModeActive}
          spellcheck="false"
        />
        <datalist id=${datalistId}>
          ${this.allPrompts.map(prompt => html`
            <option value="${prompt}"></option>
          `)}
        </datalist>
        <div id="midi" @click=${this.toggleLearnMode}>
          ${this.learnMode ? 'Learn' : `CC:${this.cc}`}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-controller': PromptController;
  }
}
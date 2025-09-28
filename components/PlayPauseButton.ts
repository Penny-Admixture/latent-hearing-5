/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { svg, css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlaybackState } from '../types';

@customElement('play-pause-button')
export class PlayPauseButton extends LitElement {

  @property({ type: String }) playbackState: PlaybackState = 'stopped';

  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 80%;
      height: 80%;
    }
    .icon {
        fill: var(--play-pause-icon-fill, #e0e0e0);
    }
    .loader {
      stroke: var(--play-pause-icon-fill, #e0e0e0);
      stroke-width: 2.5;
      stroke-linecap: round;
      animation: spin linear 1s infinite;
      transform-origin: center;
      transform-box: fill-box;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(359deg); }
    }
  `;

  private renderPause() {
    return svg`<g class="icon"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></g>`;
  }

  private renderPlay() {
    return svg`<path class="icon" d="M8 5v14l11-7z"/>`;
  }

  private renderLoading() {
    return svg`<path class="loader" d="M12,2.5 A9.5,9.5 0 0,1 21.5,12" fill="none" />`;
  }
  
  private renderIcon() {
    if (this.playbackState === 'playing') return this.renderPause();
    if (this.playbackState === 'loading') return this.renderLoading();
    return this.renderPlay();
  }

  override render() {
    return html`
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        ${this.renderIcon()}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'play-pause-button': PlayPauseButton
  }
}
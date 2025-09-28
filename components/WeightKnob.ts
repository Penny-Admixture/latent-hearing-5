

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

/** A knob for adjusting and visualizing prompt weight. */
@customElement('weight-knob')
// FIX: The class must extend LitElement to be a custom element.
export class WeightKnob extends LitElement {
  static override styles = css`
    :host {
      cursor: ns-resize;
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      flex-shrink: 0;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    :host([disabled]) {
      cursor: not-allowed;
      opacity: 0.8;
    }
    svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .emanating-squares {
      z-index: -1;
      pointer-events: none;
      overflow: visible;
    }
    .emanating-squares rect {
      fill: none;
      stroke: var(--knob-halo-color);
      stroke-width: 1.5;
      transform-origin: center center;
      animation: emanate 4s ease-out infinite;
      opacity: 0;
      stroke-dasharray: 50 190; /* Perimeter of 60x60 is 240. dash + gap */
    }
    .emanating-squares rect:nth-child(2) {
      animation-delay: 1s;
    }
    .emanating-squares rect:nth-child(3) {
      animation-delay: 2s;
    }
    .emanating-squares rect:nth-child(4) {
      animation-delay: 3s;
    }
    @keyframes emanate {
      0% {
        transform: scale(0.8);
        opacity: var(--emanate-opacity);
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dashoffset: -120;
      }
      100% {
        transform: scale(2);
        opacity: 0;
        stroke-dashoffset: -240;
      }
    }
  `;

  @property({ type: Number }) value = 0;
  @property({ type: String }) color = '#fff';
  @property({ type: Number }) audioLevel = 0;
  @property({ type: Boolean, reflect: true }) disabled = false;

  private dragStartPos = 0;
  private dragStartValue = 0;

  constructor() {
    super();
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent) {
    if (this.disabled) return;
    e.preventDefault();
    this.dragStartPos = e.clientY;
    this.dragStartValue = this.value;
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private handlePointerMove(e: PointerEvent) {
    const delta = this.dragStartPos - e.clientY;
    this.value = this.dragStartValue + delta * 0.01;
    this.value = Math.max(0, Math.min(2, this.value));
    this.dispatchEvent(new CustomEvent<number>('input', { detail: this.value }));
  }

  private handlePointerUp() {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    document.body.classList.remove('dragging');
  }

  private handleWheel(e: WheelEvent) {
    if (this.disabled) return;
    e.preventDefault();
    const delta = e.deltaY;
    this.value = this.value + delta * -0.0025;
    this.value = Math.max(0, Math.min(2, this.value));
    this.dispatchEvent(new CustomEvent<number>('input', { detail: this.value }));
  }

  override render() {
    const fillPercent = this.value / 2; // value is 0-2, so this is 0-1
    
    const effectStyles = styleMap({
      '--knob-halo-color': this.color,
      '--emanate-opacity': `${this.value > 0 ? fillPercent * 0.6 + this.audioLevel * 0.4 : 0}`,
    });

    return html`
      ${this.value > 0 ? html`
        <svg class="emanating-squares" style=${effectStyles} viewBox="0 0 100 100">
          <rect x="20" y="20" width="60" height="60" rx="12"/>
          <rect x="20" y="20" width="60" height="60" rx="12"/>
          <rect x="20" y="20" width="60" height="60" rx="12"/>
          <rect x="20" y="20" width="60" height="60" rx="12"/>
        </svg>` : ''}
        
      <svg
        viewBox="0 0 100 100"
        @pointerdown=${this.handlePointerDown}
        @wheel=${this.handleWheel}>
        
        <defs>
          <linearGradient id="metal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--knob-metal-stop-1)" />
            <stop offset="50%" stop-color="var(--knob-metal-stop-2)" />
            <stop offset="100%" stop-color="var(--knob-metal-stop-3)" />
          </linearGradient>
          <linearGradient id="bezel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--knob-bezel-stop-1)" />
            <stop offset="100%" stop-color="var(--knob-bezel-stop-2)" />
          </linearGradient>
          <linearGradient id="fill-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color=${this.color} stop-opacity="1" />
            <stop offset="100%" stop-color=${this.color} stop-opacity="0.5" />
          </linearGradient>
          <clipPath id="fill-clip-path">
             <rect 
                x="12" 
                y=${12 + (76 * (1 - fillPercent))} 
                width="76" 
                height=${76 * fillPercent} 
             />
          </clipPath>
        </defs>

        <rect x="5" y="5" width="90" height="90" rx="20" fill="url(#metal-grad)" />
        <rect x="10" y="10" width="80" height="80" rx="16" fill="url(#metal-grad)" stroke="url(#bezel-grad)" stroke-width="2" />
        
        <g clip-path="url(#fill-clip-path)">
          <rect x="12" y="12" width="76" height="76" rx="14" fill="url(#fill-grad)" />
        </g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'weight-knob': WeightKnob;
  }
}
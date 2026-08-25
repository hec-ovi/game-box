import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The counter: the window's chrome at a smaller size, in the same room and
 * behind the window, with the seller's name for its title. A row is the
 * thing, its price and the button that buys it; a price the player cannot
 * meet is warned and its button is off.
 */
export const COUNTER = `
.gb-counter-room { z-index: ${LAYERS.counter}; }
.gb-window.gb-counter { width: ${LAYOUT.counter.width}px; height: ${LAYOUT.counter.height}px; }
.gb-counter-seller {
  align-self: center;
  padding: 0 var(--gb-s4);
  font-family: var(--gb-display);
  font-size: 14px;
  letter-spacing: 0.18em;
  color: var(--gb-accent);
}
.gb-counter-credits {
  display: flex;
  align-items: baseline;
  gap: var(--gb-s2);
  padding-bottom: var(--gb-s3);
  margin-bottom: var(--gb-s3);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-counter-credits .gb-label { color: var(--gb-faint); }
.gb-counter-credits .gb-num { font-size: 22px; color: var(--gb-accent); }
.gb-offers li { display: flex; align-items: center; gap: var(--gb-s3); padding: var(--gb-s2) 0; border-top: 1px solid rgba(242, 239, 230, 0.07); }
.gb-offers li:first-child { border-top: none; }
.gb-offer .gb-what { flex: 1; }
.gb-offer .gb-price { color: var(--gb-ink); font-size: 13px; }
.gb-offer[data-short='true'] .gb-price { color: var(--gb-warn); }
.gb-buy {
  padding: var(--gb-s1) var(--gb-s3);
  border: 1px solid var(--gb-accent-deep);
  background: var(--gb-lift);
  color: var(--gb-accent);
  font-family: var(--gb-display);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), color var(--gb-t) var(--gb-ease),
    background var(--gb-t) var(--gb-ease);
}
.gb-buy:hover:not(:disabled) { border-color: var(--gb-accent); background: var(--gb-accent); color: var(--gb-accent-ink); }
.gb-buy:disabled { border-color: var(--gb-edge); color: var(--gb-faint); cursor: default; }
`

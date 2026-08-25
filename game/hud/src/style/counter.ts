import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The counter: the window's chrome at a smaller size, in the same room and
 * behind the window, with the seller's name for its title and the player's
 * credits on a plate beside it. A row is the thing, its price and the button
 * that buys it; a price the player cannot meet is warned and its button off.
 */
export const COUNTER = `
.gb-hud .gb-counter-room { z-index: ${LAYERS.counter}; }
.gb-hud .gb-window.gb-counter { width: ${LAYOUT.counter.width}px; height: ${LAYOUT.counter.height}px; }

/* What there is to spend, read where the prices are. */
.gb-hud .gb-plate-credits {
  --cut: var(--gb-cut-chip);
  --gb-face: var(--gb-lift);
  --gb-line: var(--gb-edge-accent);
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  padding: 5px var(--gb-s3);
  color: var(--gb-dim);
}
.gb-hud .gb-plate-credits .gb-num { color: var(--gb-accent); }
.gb-hud .gb-offer .gb-price { color: var(--gb-ink); }
.gb-hud .gb-offer[data-short='true'] .gb-price { color: var(--gb-warn); }
`

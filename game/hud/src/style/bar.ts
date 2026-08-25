import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The controls the player clicks: the bar into the window and out of the
 * game, the close button that carries its own key, and the "these keys do
 * this" rows. They share one hover, one focus ring and one pressed state, so
 * every control in the interface answers the pointer the same way.
 */
export const BAR = `
.gb-bar {
  position: absolute;
  z-index: ${LAYERS.bar};
  left: ${LAYOUT.margin}px;
  bottom: ${LAYOUT.margin}px;
  display: flex;
  gap: 1px;
  background: rgba(0, 0, 0, 0.55);
  box-shadow: var(--gb-frame);
}
.gb-bar-button {
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s3);
  border: none;
  border-top: 2px solid transparent;
  background: var(--gb-panel);
  color: var(--gb-dim);
  font: inherit;
  pointer-events: auto;
  cursor: pointer;
  backdrop-filter: blur(10px) saturate(0.85);
  transition: background var(--gb-t) var(--gb-ease), color var(--gb-t) var(--gb-ease),
    border-color var(--gb-t) var(--gb-ease);
}
.gb-bar-button:hover { background: var(--gb-lift); color: var(--gb-ink); }
.gb-bar-button:active { transform: translateY(1px); }
.gb-bar-button[aria-expanded='true'] {
  border-top-color: var(--gb-accent);
  background: var(--gb-lift);
  color: var(--gb-accent);
}
/* The way out sits apart from the windows and is warned, not brass. */
.gb-bar-leave { margin-left: var(--gb-s2); }
.gb-bar-leave:hover { color: var(--gb-warn); }
.gb-bar[data-keys-off='true'] kbd { opacity: 0.25; }

.gb-close {
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  padding: var(--gb-s1) var(--gb-s2);
  border: 1px solid var(--gb-edge);
  background: transparent;
  color: var(--gb-dim);
  font: inherit;
  pointer-events: auto;
  cursor: pointer;
  transition: background var(--gb-t) var(--gb-ease), border-color var(--gb-t) var(--gb-ease),
    color var(--gb-t) var(--gb-ease);
}
.gb-close:hover { border-color: var(--gb-warn); background: rgba(216, 88, 58, 0.16); color: var(--gb-ink); }
.gb-close:active { transform: translateY(1px); }

.gb-hud button:focus-visible, .gb-hud input:focus-visible {
  outline: 2px solid var(--gb-accent);
  outline-offset: 2px;
}

/* "Enter sends, Escape walks away", under the box it applies to. */
.gb-hints { display: flex; flex-wrap: wrap; gap: var(--gb-s3); margin-top: var(--gb-s3); }
.gb-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--gb-faint); }
.gb-keys { display: flex; gap: 3px; }

/* A bar that fills: how far a stage or a timer has got. */
.gb-bar-track { height: 3px; background: var(--gb-well); border: 1px solid var(--gb-edge); }
.gb-bar-fill { height: 100%; background: var(--gb-accent); transition: width var(--gb-t) var(--gb-ease); }
`

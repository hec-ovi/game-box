import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The conversation: a panel of fixed width down the right of the view, the one
 * part of the interface that holds the keyboard. The speaker's name plate sits
 * over the transcript; the moves and the box sit under it, where the player
 * answers. The transcript takes whatever height is left and scrolls; the panel
 * never changes size for what arrives.
 */
export const TALK = `
.gb-hud .gb-talk {
  position: fixed;
  z-index: ${LAYERS.side};
  right: 0px;
  top: 0px;
  bottom: ${LAYOUT.foot}px;
  width: ${LAYOUT.side + 30}px;
  display: flex;
  flex-direction: column;
  background: var(--gb-glass);
  border-left: 1px solid var(--gb-edge-accent);
  box-shadow: -4px 0 24px var(--gb-shadow);
  pointer-events: auto;
}

.gb-hud .gb-talk .gb-head {
  padding: var(--gb-s3) var(--gb-s4);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-hud .gb-talk .gb-head-name {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gb-accent-lit);
  font-weight: 700;
}

/* The transcript: every turn so far, the player's and the speaker's apart. */
.gb-hud .gb-transcript {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s3);
  padding: var(--gb-s4);
  overflow-y: auto;
}
.gb-hud .gb-turn { display: flex; flex-direction: column; gap: 2px; }
.gb-hud .gb-turn-name {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.gb-hud .gb-turn[data-who='them'] .gb-turn-name {
  color: var(--gb-good);
}
.gb-hud .gb-turn[data-who='you'] .gb-turn-name {
  color: var(--gb-accent);
  align-self: flex-end;
}
.gb-hud .gb-turn .gb-says {
  white-space: pre-wrap;
  line-height: 1.45;
}
.gb-hud .gb-turn[data-who='them'] .gb-says {
  --cut: var(--gb-cut-row);
  align-self: flex-start;
  max-width: 90%;
  padding: var(--gb-s2) var(--gb-s3);
  background: var(--gb-well);
  border-left: 3px solid var(--gb-good);
  color: var(--gb-ink);
  font-size: 13.5px;
}
.gb-hud .gb-turn[data-who='you'] .gb-says {
  --cut: var(--gb-cut-row);
  align-self: flex-end;
  max-width: 90%;
  padding: var(--gb-s2) var(--gb-s3);
  background: var(--gb-lift);
  border-right: 3px solid var(--gb-accent);
  color: var(--gb-ink);
  text-align: right;
  font-size: 13.5px;
}
/* Stage direction: what they did, set apart from what they said. */
.gb-hud .gb-turn .gb-does { color: var(--gb-faint); font-style: italic; }

.gb-hud .gb-talk-foot { flex: none; padding: var(--gb-s3) var(--gb-s4); pointer-events: auto; }
/* What the player can do without saying a word. Positioned at bottom-left as cyber items. */
.gb-hud .gb-talk .gb-moves {
  position: fixed;
  left: 24px;
  bottom: ${LAYOUT.foot + 16}px;
  width: ${LAYOUT.corner.width + 80}px;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s2);
  max-height: 38vh;
  z-index: ${LAYERS.side + 1};
  pointer-events: auto;
}
.gb-hud .gb-talk .gb-moves li {
  pointer-events: auto;
}
.gb-hud .gb-move {
  --cut: var(--gb-cut-row);
  --gb-face: var(--gb-solid);
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  width: 100%;
  padding: 10px var(--gb-s3);
  border: 1px solid var(--gb-edge);
  box-shadow: inset 4px 0 0 var(--gb-accent);
  color: var(--gb-ink);
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-move .gb-what { flex: 1; min-width: 0; font-weight: 500; }
.gb-hud .gb-move .gb-num {
  padding: 2px 6px;
  background: var(--gb-well);
  border: 1px solid var(--gb-edge);
  color: var(--gb-accent);
  font-family: var(--gb-mono);
  font-size: 11px;
}
.gb-hud .gb-move:hover:not(:disabled), .gb-hud .gb-move:focus-visible {
  background: var(--gb-lift);
  --gb-line: var(--gb-accent);
  color: var(--gb-accent-lit);
  box-shadow: inset 6px 0 0 var(--gb-accent-lit);
}
/* Waiting on the answer: the menu is still there to read, and takes nothing. */
.gb-hud .gb-move:disabled { opacity: 0.5; cursor: default; }

.gb-hud .gb-talk-input-row {
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
}
.gb-hud .gb-talk-input-row .gb-say {
  flex: 1;
  min-width: 0;
  margin: 0;
  background: var(--gb-solid);
  border: 1px solid var(--gb-edge-accent);
  color: var(--gb-ink);
  padding: 10px 14px;
  font: inherit;
  font-family: var(--gb-mono);
}
.gb-hud .gb-talk-input-row .gb-say:focus {
  --gb-line: var(--gb-accent);
  box-shadow: 0 0 14px var(--gb-edge-lit);
}
.gb-hud .gb-talk-input-row .gb-say::placeholder {
  color: var(--gb-faint);
}
.gb-hud .gb-talk-input-row .gb-say:disabled {
  opacity: 0.6;
  background: var(--gb-lift);
}
.gb-hud .gb-talk-send-btn {
  width: 38px;
  height: 38px;
  --cut: var(--gb-cut-key);
  background: var(--gb-well);
  border: 1px solid var(--gb-edge-accent);
  color: var(--gb-accent-lit);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-talk-send-btn:hover:not(:disabled) {
  background: var(--gb-lift);
  --gb-line: var(--gb-accent);
  color: var(--gb-accent);
}
.gb-hud .gb-talk-send-btn:disabled {
  opacity: 0.8;
  cursor: default;
}
.gb-hud .gb-ai-thinking-orb {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex: none;
}
.gb-hud .gb-ai-thinking-orb[data-thinking='true']::before {
  content: '';
  width: 9px;
  height: 9px;
  background: var(--gb-accent);
  transform: rotate(45deg);
  animation: gb-orb-pulse 1.2s ease-in-out infinite alternate;
}
.gb-hud .gb-ai-thinking-orb[data-thinking='true']::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--gb-accent-lit);
  animation: gb-orb-spin 2s linear infinite;
}
`

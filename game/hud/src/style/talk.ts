import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The conversation: a panel of fixed width down the right of the view, the one
 * part of the interface that holds the keyboard. The speaker's name plate sits
 * over the transcript; the moves and the box sit under it, where the player
 * answers. The transcript takes whatever height is left and scrolls; the panel
 * never changes size for what arrives.
 *
 * It is sheer, and the street carries on behind it. A blur would read better
 * and is not allowed over a running scene, so the density does the work: a
 * gradient across the panel, sheerest at the inner edge where the city should
 * show through and deepest under the column of text.
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
  background: var(--gb-sheer);
  border-left: 1px solid var(--gb-edge-accent);
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
.gb-hud .gb-turn .gb-says {
  white-space: pre-wrap;
  line-height: 1.45;
}
.gb-hud .gb-turn[data-who='them'] .gb-says {
  --cut: var(--gb-cut-row);
  align-self: flex-start;
  max-width: 90%;
  padding: var(--gb-s2) var(--gb-s3);
  background: var(--gb-sheer-well);
  border-left: 3px solid var(--gb-good);
  color: var(--gb-ink);
  font-size: 13.5px;
}
.gb-hud .gb-turn[data-who='you'] .gb-says {
  --cut: var(--gb-cut-row);
  align-self: flex-end;
  max-width: 90%;
  padding: var(--gb-s2) var(--gb-s3);
  background: var(--gb-sheer-lift);
  border-right: 3px solid var(--gb-accent);
  color: var(--gb-ink);
  text-align: right;
  font-size: 13.5px;
}
/* Stage direction: what they did, set apart from what they said. */
.gb-hud .gb-turn .gb-does { color: var(--gb-faint); font-style: italic; }

.gb-hud .gb-talk-foot { flex: none; padding: var(--gb-s3) var(--gb-s4); pointer-events: auto; }
/* What the player can do without saying a word: at the foot of the screen over
   the bar, not in the panel. It is mounted beside the panel because a panel
   that slides in on a transform is the containing block for anything fixed
   inside it, and these are fixed to the screen. */
.gb-hud .gb-moves {
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
.gb-hud .gb-moves li {
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

/* The box and the send are one control. Corners are square everywhere else in
   this interface; he asked for this one round, so the box runs into a round end
   with the button sitting in it. */
.gb-hud .gb-talk-input-row {
  position: relative;
  display: flex;
  align-items: center;
}
.gb-hud .gb-talk-input-row .gb-say {
  flex: 1;
  min-width: 0;
  margin: 0;
  background: var(--gb-solid);
  border: 1px solid var(--gb-edge-accent);
  border-radius: 0 22px 22px 0;
  color: var(--gb-ink);
  padding: 10px 52px 10px 14px;
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
  position: absolute;
  right: 5px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--gb-accent);
  border: none;
  color: var(--gb-accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-talk-send-btn:hover:not(:disabled) { background: var(--gb-accent-lit); }
/* Waiting on the answer: it stops taking clicks and turns into the orb. */
.gb-hud .gb-talk-send-btn:disabled {
  background: transparent;
  cursor: default;
}
.gb-hud .gb-talk-send-btn > [hidden] { display: none; }
.gb-hud .gb-ai-thinking-orb {
  position: relative;
  width: 26px;
  height: 26px;
  display: block;
}
/* The core: it breathes rather than spins, so the two motions read apart. */
.gb-hud .gb-ai-thinking-orb::before {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  background: var(--gb-accent);
  animation: gb-orb-breathe 1.4s ease-in-out infinite alternate;
}
/* The ring: one gap in it, turning, which is what makes the turn readable. */
.gb-hud .gb-ai-thinking-orb::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--gb-accent-lit);
  border-right-color: transparent;
  border-bottom-color: transparent;
  animation: gb-orb-spin 0.9s linear infinite;
}

/* The moment between the question going out and the first word coming back. */
.gb-hud .gb-says-waiting {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 1.45em;
}
.gb-hud .gb-says-waiting i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gb-good);
  animation: gb-wait-dot 1.1s ease-in-out infinite;
}
.gb-hud .gb-says-waiting i:nth-child(2) { animation-delay: 0.18s; }
.gb-hud .gb-says-waiting i:nth-child(3) { animation-delay: 0.36s; }
`

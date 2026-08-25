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
  position: absolute;
  z-index: ${LAYERS.side};
  right: ${LAYOUT.margin}px;
  top: ${LAYOUT.margin}px;
  bottom: ${LAYOUT.foot}px;
  width: ${LAYOUT.side}px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

/* The transcript: every turn so far, the player's and the speaker's apart. */
.gb-hud .gb-transcript {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s3);
  padding: var(--gb-s3) var(--gb-s4);
}
.gb-hud .gb-turn { display: flex; flex-direction: column; gap: 3px; }
.gb-hud .gb-turn .gb-says { white-space: pre-wrap; }
.gb-hud .gb-turn[data-who='them'] .gb-says { color: var(--gb-ink); }
.gb-hud .gb-turn[data-who='you'] {
  --cut: var(--gb-cut-row);
  align-self: flex-end;
  max-width: 88%;
  padding: var(--gb-s1) var(--gb-s3);
  background: var(--gb-well);
  box-shadow: inset -2px 0 0 var(--gb-accent);
  color: var(--gb-dim);
  text-align: right;
}
/* Stage direction: what they did, set apart from what they said. */
.gb-hud .gb-turn .gb-does { color: var(--gb-faint); font-style: italic; }

.gb-hud .gb-talk-foot { flex: none; padding: 0 var(--gb-s4) var(--gb-s4); }
/* What the player can do without saying a word. Drawn only while there is
   something on it, because a menu of one obvious thing is noise. */
.gb-hud .gb-talk .gb-moves {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 34vh;
}
.gb-hud .gb-talk .gb-moves:not(:empty) { margin-bottom: var(--gb-s3); }
.gb-hud .gb-move {
  --cut: var(--gb-cut-row);
  --gb-face: var(--gb-lift);
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  width: 100%;
  padding: 8px var(--gb-s3);
  border: none;
  box-shadow: inset 2px 0 0 var(--gb-accent);
  color: var(--gb-ink);
  text-align: left;
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in),
    opacity var(--gb-t-state) var(--gb-in);
}
.gb-hud .gb-move .gb-what { flex: 1; min-width: 0; }
.gb-hud .gb-move .gb-num { color: var(--gb-accent); }
.gb-hud .gb-move:hover:not(:disabled), .gb-hud .gb-move:focus-visible { --gb-line: var(--gb-edge-lit); color: var(--gb-accent-lit); }
/* Waiting on the answer: the menu is still there to read, and takes nothing. */
.gb-hud .gb-move:disabled { opacity: 0.5; cursor: default; }
.gb-hud .gb-talk .gb-say { margin: 0; }
`

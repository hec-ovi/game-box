import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The conversation: a panel of fixed width down the right of the view, the one
 * part of the interface that holds the keyboard, so it says how to leave in
 * two places and looks like something being said rather than something being
 * displayed. The transcript takes whatever height the panel has and scrolls;
 * the moves and the box sit under it, where the player answers.
 */
export const TALK = `
.gb-talk {
  position: absolute;
  right: ${LAYOUT.margin}px;
  top: ${LAYOUT.margin}px;
  bottom: ${LAYOUT.foot}px;
  width: ${LAYOUT.side}px;
  display: flex;
  flex-direction: column;
  padding: var(--gb-s4) var(--gb-s4) var(--gb-s4);
  background: var(--gb-panel);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(12px) saturate(0.85);
  pointer-events: auto;
  z-index: ${LAYERS.side};
}
.gb-talk[data-state='opening'], .gb-talk[data-state='closing'] { transform: translateX(12px); }
.gb-talk[data-state='open'] { transform: translateX(0); }
.gb-talk-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gb-s3);
  padding-bottom: var(--gb-s2);
  margin-bottom: var(--gb-s3);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-talk-head h3 {
  font-family: var(--gb-display);
  font-size: 14px;
  letter-spacing: 0.18em;
  color: var(--gb-accent);
}

/* The transcript: every turn so far, the player's and the speaker's apart. */
.gb-transcript {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s3);
  margin-bottom: var(--gb-s3);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gb-accent-deep) transparent;
}
.gb-turn { display: flex; flex-direction: column; gap: 3px; }
.gb-turn .gb-says { white-space: pre-wrap; }
.gb-turn[data-who='them'] .gb-says { font-size: 15px; line-height: 1.6; }
.gb-turn[data-who='you'] {
  align-self: flex-end;
  max-width: 88%;
  padding: var(--gb-s1) var(--gb-s3);
  border-right: 2px solid var(--gb-accent);
  background: var(--gb-well);
  color: var(--gb-dim);
  font-size: 13px;
  text-align: right;
}
.gb-turn[data-who='you'] .gb-says::before { content: '\\203A\\00a0'; color: var(--gb-accent); }
/* Stage direction: what they did, set apart from what they said. */
.gb-turn .gb-does {
  padding-left: var(--gb-s2);
  border-left: 2px solid var(--gb-accent-deep);
  color: var(--gb-dim);
  font-size: 12px;
  font-style: italic;
}

.gb-talk-foot { flex: none; }
/* What the player can do without saying a word. Drawn only when there is
   something on it, because a menu of one obvious thing is noise. */
.gb-talk .gb-moves {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 34vh;
  overflow-y: auto;
}
.gb-talk .gb-moves:not(:empty) { margin-bottom: var(--gb-s3); }
.gb-move {
  display: block;
  width: 100%;
  padding: 7px var(--gb-s3);
  border: 1px solid var(--gb-edge);
  /* full brass down the edge: the one thing in the panel that acts on a click,
     against the box below it, which only takes words */
  border-left: 2px solid var(--gb-accent);
  background: var(--gb-lift);
  color: var(--gb-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease),
    color var(--gb-t) var(--gb-ease);
}
.gb-move::before { content: '\\203A\\00a0'; color: var(--gb-accent); }
.gb-move:hover:not(:disabled), .gb-move:focus-visible {
  border-color: var(--gb-accent);
  background: var(--gb-accent);
  color: var(--gb-accent-ink);
  outline: none;
}
.gb-move:hover:not(:disabled)::before, .gb-move:focus-visible::before { color: var(--gb-accent-ink); }
/* Waiting on the answer: the menu is still there to read, and takes nothing. */
.gb-move:disabled {
  border-left-color: var(--gb-edge);
  background: transparent;
  color: var(--gb-faint);
  cursor: default;
}
.gb-move:disabled::before { color: var(--gb-faint); }
.gb-talk .gb-say {
  width: 100%;
  padding: var(--gb-s3);
  border: 1px solid var(--gb-edge);
  border-left: 2px solid var(--gb-accent-deep);
  background: var(--gb-well);
  color: var(--gb-ink);
  font: inherit;
  transition: border-color var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease);
}
.gb-talk .gb-say::placeholder { color: var(--gb-faint); }
.gb-talk .gb-say:focus {
  border-left-color: var(--gb-accent);
  background: rgba(0, 0, 0, 0.6);
  outline: none;
}
.gb-talk .gb-say:focus-visible { outline: none; }
`

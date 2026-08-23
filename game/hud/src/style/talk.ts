/**
 * The conversation: the one part of the interface that holds the keyboard, so
 * it says how to leave in two places and looks like something being said rather
 * than something being displayed. The moves sit between the reply and the box,
 * because picking one and typing one are the same answer given two ways.
 */
export const TALK = `
.gb-talk {
  position: absolute;
  left: 50%;
  bottom: 80px;
  transform: translateX(-50%);
  width: min(740px, calc(100vw - 48px));
  padding: var(--gb-s4) var(--gb-s5) var(--gb-s4);
  background: var(--gb-panel);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(12px) saturate(0.85);
  pointer-events: auto;
  z-index: 2;
}
.gb-talk[data-state='opening'], .gb-talk[data-state='closing'] { transform: translateX(-50%) translateY(12px); }
.gb-talk[data-state='open'] { transform: translateX(-50%) translateY(0); }
.gb-talk-head {
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
/* The player's own last line, above the answer to it. */
.gb-talk .gb-you:not(:empty) {
  margin-bottom: var(--gb-s2);
  color: var(--gb-dim);
  font-size: 13px;
}
.gb-talk .gb-you:not(:empty)::before { content: '\\203A\\00a0'; color: var(--gb-accent); }
.gb-talk .gb-reply {
  min-height: 3.4em;
  margin-bottom: var(--gb-s3);
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.gb-talk .gb-acted:not(:empty) {
  margin-bottom: var(--gb-s3);
  padding-left: var(--gb-s2);
  border-left: 2px solid var(--gb-accent-deep);
  font-size: 12px;
  color: var(--gb-dim);
}
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
  border-left: 2px solid var(--gb-accent-deep);
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

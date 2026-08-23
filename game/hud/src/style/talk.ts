/**
 * The conversation: the one part of the interface that holds the keyboard, so
 * it says how to leave in two places and looks like something being said rather
 * than something being displayed.
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

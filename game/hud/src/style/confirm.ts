import { INNER_LEFT, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * "You sure?": a small frame in the same room the window and the counter use,
 * in front of both. What it is about, the question in a line, and the two
 * answers with their keys on them. Yes is the lit one and takes the ring,
 * because the keyboard and the ring never give two different answers.
 */
export const CONFIRM_CSS = `
.gb-hud .gb-confirm-room {
  position: absolute;
  left: 0px;
  right: 0px;
  top: 0px;
  bottom: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: ${LAYERS.confirm};
}
.gb-hud[data-talk='true'] .gb-confirm-room { right: 0px; }

.gb-hud .gb-confirm {
  width: ${LAYOUT.confirm.width}px;
  max-width: 100%;
  padding: var(--gb-s5);
  pointer-events: auto;
}
.gb-hud .gb-confirm-head { display: flex; align-items: center; gap: var(--gb-s2); margin-bottom: var(--gb-s2); color: var(--gb-dim); }
.gb-hud .gb-confirm-question { color: var(--gb-ink); }
.gb-hud .gb-confirm-acts { display: flex; justify-content: flex-end; gap: var(--gb-s2); margin-top: var(--gb-s5); }
`

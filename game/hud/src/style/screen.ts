import { LAYERS } from './layout.ts'

/**
 * A machine's screen: a frame in the middle of the view, in front of the
 * window, with the machine's name over a pane of glass. The glass is text,
 * one grid of characters whatever runs on it, so its size is fixed by what
 * it holds and never by what is written there.
 */
export const SCREEN = `
.gb-screen-room {
  position: absolute;
  inset: 0;
  z-index: ${LAYERS.screen};
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.gb-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  background: var(--gb-solid);
  box-shadow: var(--gb-frame);
  pointer-events: auto;
}
.gb-screen:focus { outline: none; }
.gb-screen[data-state='opening'], .gb-screen[data-state='closing'] { transform: scale(0.985) translateY(6px); }
.gb-screen[data-state='open'] { transform: scale(1) translateY(0); }
.gb-screen-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gb-s3);
  padding: var(--gb-s2) var(--gb-s3) var(--gb-s2) var(--gb-s4);
  background: rgba(0, 0, 0, 0.35) var(--gb-hatch);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-screen-head h3 {
  font-family: var(--gb-display);
  font-size: 14px;
  letter-spacing: 0.18em;
  color: var(--gb-accent);
}
.gb-screen-text {
  margin: 0;
  padding: var(--gb-s3) var(--gb-s4);
  background: var(--gb-glass);
  color: var(--gb-phosphor);
  font: 14px/1.35 var(--gb-mono);
  white-space: pre;
  overflow: hidden;
  text-shadow: 0 0 6px var(--gb-phosphor-dim);
}
`

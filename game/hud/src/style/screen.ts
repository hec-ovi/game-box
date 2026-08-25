import { LAYERS } from './layout.ts'

/**
 * A machine's screen: a frame in the middle of the view, in front of the
 * window, with the machine's name over a pane of glass. The glass is its own
 * world, green phosphor on black, untouched by the palette around it; the
 * name and the close button wear the interface's own type, so the machine
 * reads as a thing in the world with the interface around it.
 */
export const SCREEN = `
.gb-hud .gb-screen-room {
  position: absolute;
  inset: 0;
  z-index: ${LAYERS.screen};
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.gb-hud .gb-screen {
  --cut: var(--gb-cut-panel);
  --gb-face: var(--gb-solid);
  --gb-line: var(--gb-phosphor-dim);
  display: flex;
  flex-direction: column;
  max-width: 100%;
  filter: var(--gb-frame);
  pointer-events: auto;
}
.gb-hud .gb-screen .gb-head { color: var(--gb-phosphor); }
.gb-hud .gb-screen .gb-head::after { background: var(--gb-phosphor-dim); }
.gb-hud .gb-screen-text {
  margin: 0;
  padding: var(--gb-s3) var(--gb-s4);
  background: var(--gb-glass);
  color: var(--gb-phosphor);
  font: 14px/1.35 var(--gb-mono);
  white-space: pre;
  overflow: hidden;
  text-shadow: 0 0 6px var(--gb-phosphor-dim);
}
.gb-hud .gb-screen .gb-ticks::before, .gb-hud .gb-screen .gb-ticks::after { border-color: var(--gb-phosphor); }
`

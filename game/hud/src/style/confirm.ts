import { INNER_LEFT, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * "You sure?": a small frame in the same room the window and the counter use,
 * in front of both, with the two answers side by side and their keys on them.
 * The top edge is warned rather than brass, because what it asks about is
 * always something the player cannot undo.
 */
export const CONFIRM_CSS = `
.gb-confirm-room {
  position: absolute;
  left: ${INNER_LEFT}px;
  right: ${LAYOUT.margin}px;
  top: ${LAYOUT.top}px;
  bottom: ${LAYOUT.foot}px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: ${LAYERS.confirm};
}
.gb-hud[data-talk='true'] .gb-confirm-room { right: ${SIDE_RIGHT}px; }

.gb-confirm {
  position: relative;
  width: ${LAYOUT.confirm.width}px;
  max-width: 100%;
  padding: var(--gb-s5);
  background: var(--gb-solid);
  border-top: 2px solid var(--gb-warn);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(16px) saturate(0.85);
  pointer-events: auto;
}
.gb-confirm:focus { outline: none; }
.gb-confirm[data-state='opening'], .gb-confirm[data-state='closing'] { transform: scale(0.985) translateY(6px); }
.gb-confirm[data-state='open'] { transform: scale(1) translateY(0); }
.gb-confirm h2 { margin-bottom: var(--gb-s2); color: var(--gb-warn); }
.gb-confirm-question { color: var(--gb-ink); }
.gb-confirm-acts { display: flex; justify-content: flex-end; gap: var(--gb-s2); margin-top: var(--gb-s5); }
.gb-confirm-acts button {
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s4);
  border: 1px solid var(--gb-edge);
  background: var(--gb-lift);
  color: var(--gb-ink);
  font: inherit;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease),
    color var(--gb-t) var(--gb-ease);
}
.gb-confirm-no:hover { border-color: var(--gb-accent); color: var(--gb-accent); }
.gb-confirm-yes { border-color: var(--gb-warn); }
.gb-confirm-yes:hover { background: var(--gb-warn); color: var(--gb-ink); }
`

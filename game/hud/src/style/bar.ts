import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The foot bar: a band across the bottom of the view with one button per face
 * of the window and the way out at its right. The band never moves; only its
 * buttons answer the pointer, and clicks between them fall through to the
 * street.
 */
export const BAR = `
.gb-hud .gb-bar {
  position: absolute;
  z-index: ${LAYERS.bar};
  left: 0;
  right: 0;
  bottom: 0;
  height: ${LAYOUT.foot}px;
  display: flex;
  align-items: center;
  gap: var(--gb-s1);
  padding: 0 ${LAYOUT.margin}px;
  background: var(--gb-panel);
  box-shadow: inset 0 1px 0 var(--gb-edge);
  pointer-events: none;
}
.gb-hud .gb-bar-button {
  --cut: var(--gb-cut-row);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  height: 62px;
  padding: var(--gb-s2) var(--gb-s3) 0;
  border: none;
  background: transparent;
  color: var(--gb-dim);
  pointer-events: auto;
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-bar-button:hover { background: var(--gb-lift); color: var(--gb-ink); }
.gb-hud .gb-bar-button:focus-visible { background: var(--gb-lift); color: var(--gb-accent-lit); }
.gb-hud .gb-bar-button::after {
  content: '';
  position: absolute;
  left: var(--gb-s3);
  right: var(--gb-s3);
  bottom: 0;
  height: 2px;
  background: var(--gb-accent);
  transform: scaleX(0);
  transition: transform var(--gb-t-state) var(--gb-in);
}
.gb-hud .gb-bar-button[aria-expanded='true'] { background: var(--gb-lift); color: var(--gb-ink); }
.gb-hud .gb-bar-button[aria-expanded='true']::after { transform: scaleX(1); }
.gb-hud .gb-bar-button[aria-expanded='true'] kbd { --gb-line: var(--gb-accent); color: var(--gb-accent); }
/* The way out sits apart from the faces, and is warned rather than accent. */
.gb-hud .gb-bar-leave { margin-left: auto; }
.gb-hud .gb-bar-leave:hover { color: var(--gb-danger); }
.gb-hud .gb-bar-leave::after { background: var(--gb-danger); }
.gb-hud .gb-bar[data-keys-off='true'] kbd { opacity: 0.25; }

/* The close button: styled to match permanent footer buttons */
.gb-hud .gb-close {
  --cut: var(--gb-cut-row);
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--gb-s2);
  height: 38px;
  padding: 0 var(--gb-s3);
  background: var(--gb-well);
  border: 1px solid var(--gb-edge);
  color: var(--gb-dim);
  cursor: pointer;
  pointer-events: auto;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-close:hover {
  background: var(--gb-lift);
  --gb-line: var(--gb-danger);
  color: var(--gb-danger);
}
.gb-hud .gb-close kbd {
  --gb-line: var(--gb-edge-accent);
  color: var(--gb-accent);
}
`

/**
 * The root, the reset, the scrolling manners and the reticle: what is true of
 * the whole interface before any one surface says anything.
 *
 * The reticle opens out and goes accent while something is in reach. It moves
 * on `transform` and changes on `color`, never on width or height, because it
 * sits over a scene drawing every frame.
 */
export const BASE = `
.gb-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  color: var(--gb-ink);
  font: 400 13px/1.45 var(--gb-body);
  -webkit-font-smoothing: antialiased;
}
.gb-hud * { box-sizing: border-box; }
.gb-hud [hidden] { display: none !important; }
.gb-hud ul, .gb-hud ol { margin: 0; padding: 0; list-style: none; }
.gb-hud p, .gb-hud h2, .gb-hud h3, .gb-hud h4 { margin: 0; font-weight: inherit; }
.gb-hud button, .gb-hud input { font: inherit; color: inherit; }
.gb-hud .gb-empty { color: var(--gb-dim); }

/* Anything that scrolls does it inside itself, in the interface's own colours. */
.gb-hud .gb-scrolls {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gb-accent-dim) transparent;
}

.gb-hud .gb-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 3px;
  margin: -1.5px 0 0 -1.5px;
  color: var(--gb-ink);
  background: currentColor;
  opacity: 0.75;
  transition: opacity var(--gb-t-press) var(--gb-in), color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-crosshair::before, .gb-hud .gb-crosshair::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transition: transform var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-crosshair::before {
  width: 1px;
  height: 24px;
  margin: -12px 0 0 1px;
  background: linear-gradient(to bottom, currentColor 0 8px, transparent 8px 16px, currentColor 16px 24px);
  transform: scaleY(0.68);
}
.gb-hud .gb-crosshair::after {
  width: 24px;
  height: 1px;
  margin: 1px 0 0 -12px;
  background: linear-gradient(to right, currentColor 0 8px, transparent 8px 16px, currentColor 16px 24px);
  transform: scaleX(0.68);
}
.gb-hud[data-reach='true'] .gb-crosshair { opacity: 1; color: var(--gb-accent); }
.gb-hud[data-reach='true'] .gb-crosshair::before { transform: scaleY(1); }
.gb-hud[data-reach='true'] .gb-crosshair::after { transform: scaleX(1); }
.gb-hud[data-modal='true'] .gb-crosshair { opacity: 0; }
`

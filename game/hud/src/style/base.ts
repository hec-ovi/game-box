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
.gb-hud button, .gb-hud input { font: inherit; color: inherit; pointer-events: auto; }
.gb-hud .gb-empty { color: var(--gb-dim); }

/* Anything that scrolls does it inside itself, in the interface's own colours. */
.gb-hud .gb-scrolls {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gb-accent-dim) transparent;
}

`

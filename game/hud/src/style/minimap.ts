import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The minimap: a square in the corner column above the foot, north up, the
 * player at its centre. It is read, never clicked, so the pointer goes through
 * it to the scene, and it is clipped to its square, so a city windowed a
 * little wide never spills into the view.
 */
export const MINIMAP_CSS = `
.gb-minimap {
  position: absolute;
  z-index: ${LAYERS.minimap};
  left: ${LAYOUT.margin}px;
  bottom: ${LAYOUT.foot}px;
  width: ${LAYOUT.minimap}px;
  height: ${LAYOUT.minimap}px;
  overflow: hidden;
  background: var(--gb-panel);
  border-top: 2px solid var(--gb-accent);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(10px) saturate(0.85);
}
.gb-minimap[data-state='opening'], .gb-minimap[data-state='closing'] { transform: translateY(6px); }
.gb-minimap[data-state='open'] { transform: translateY(0); }
.gb-near { position: absolute; inset: 0; }
.gb-near svg { display: block; width: 100%; height: 100%; }
/* Which way is up, said once in the corner rather than drawn on every push. */
.gb-minimap-north {
  position: absolute;
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--gb-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--gb-ink);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
`

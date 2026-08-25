import { LAYERS, LAYOUT } from './layout.ts'

/**
 * The minimap: a square in the corner column above the foot, north up, the
 * player at its centre. It is read, never clicked, so the pointer goes through
 * it to the scene, and it is clipped to its square, so a city windowed a
 * little wide never spills into the view.
 */
export const MINIMAP_CSS = `
.gb-hud .gb-minimap {
  --gb-face: var(--gb-well);
  position: absolute;
  z-index: ${LAYERS.minimap};
  left: ${LAYOUT.margin}px;
  bottom: ${LAYOUT.foot}px;
  width: ${LAYOUT.minimap}px;
  height: ${LAYOUT.minimap}px;
  overflow: hidden;
}
.gb-hud .gb-near { position: absolute; inset: 1px; }
.gb-hud .gb-near > svg { display: block; width: 100%; height: 100%; }
/* Which way is up, said once in the corner rather than drawn on every push. */
.gb-hud .gb-minimap-north {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--gb-dim);
}
`

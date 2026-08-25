import { INNER_LEFT, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * The strip along the top of the view: the points of the compass sliding as
 * the player turns, the tracked goal's mark at its bearing, and under it the
 * goal's name and how far. It is read, never clicked, so the pointer goes
 * through it to the scene. Everything on it moves by transform.
 */
export const COMPASS = `
.gb-hud .gb-compass {
  position: absolute;
  z-index: ${LAYERS.compass};
  left: ${INNER_LEFT}px;
  right: ${LAYOUT.margin}px;
  top: ${LAYOUT.margin}px;
  height: ${LAYOUT.compass.height}px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gb-hud[data-talk='true'] .gb-compass { right: ${SIDE_RIGHT}px; }
.gb-hud .gb-compass-strip {
  flex: none;
  width: ${LAYOUT.compass.width}px;
  height: ${LAYOUT.compass.height}px;
  overflow: hidden;
}
.gb-hud .gb-compass-track { position: absolute; top: 0; bottom: 0; left: 0; }
.gb-hud .gb-compass-tick {
  position: absolute;
  bottom: 10px;
  width: 1px;
  height: 6px;
  background: var(--gb-faint);
  transform: translateX(-50%);
}
.gb-hud .gb-compass-tick[data-point] {
  bottom: 0;
  top: 0;
  width: 22px;
  height: auto;
  background: transparent;
  color: var(--gb-ink);
  line-height: ${LAYOUT.compass.height}px;
  text-align: center;
}
.gb-hud .gb-compass-tick[data-point]::after { content: attr(data-point); }
/* The centre line: where the player is looking. */
.gb-hud .gb-compass-strip::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--gb-accent);
  opacity: 0.6;
}
/* The goal's mark, wearing what the plan and the minimap wear, in its own
   medium. Pinned to an edge while the goal is behind the player. */
.gb-hud .gb-compass-mark {
  position: absolute;
  top: 8px;
  left: 0;
  display: flex;
  transform: translateX(var(--at, 0px)) translateX(-50%);
}
.gb-hud .gb-compass-mark[data-edge] { opacity: 0.6; }
.gb-hud .gb-compass-where {
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  margin-top: 5px;
  padding: 3px var(--gb-s2);
  background: var(--gb-panel);
  color: var(--gb-ink);
}
.gb-hud .gb-compass-where .gb-num { color: var(--gb-accent); }
.gb-hud .gb-compass-where[data-line='main'] .gb-what { color: var(--gb-main); }
`

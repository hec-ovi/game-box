import { INNER_LEFT, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * The strip along the top of the view: the points of the compass sliding as
 * the player turns, the tracked goal's mark at its bearing, and under it the
 * goal's name and how far. It is read, never clicked, so the pointer goes
 * through it to the scene.
 */
export const COMPASS = `
.gb-compass {
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
.gb-compass[data-state='opening'], .gb-compass[data-state='closing'] { transform: translateY(-6px); }
.gb-compass[data-state='open'] { transform: translateY(0); }
.gb-compass-strip {
  position: relative;
  width: ${LAYOUT.compass.width}px;
  height: 22px;
  overflow: hidden;
  background: var(--gb-panel);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(10px) saturate(0.85);
  mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
}
.gb-compass-track { position: absolute; top: 0; bottom: 0; left: 0; }
.gb-compass-tick {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 5px;
  background: var(--gb-faint);
  transform: translateX(-50%);
}
.gb-compass-tick[data-point] {
  height: 100%;
  width: 20px;
  background: transparent;
  color: var(--gb-ink);
  font-family: var(--gb-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 22px;
  text-align: center;
}
.gb-compass-tick[data-point]::after { content: attr(data-point); }
/* The centre line: where the player is looking. */
.gb-compass-strip::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--gb-accent);
  opacity: 0.6;
}
/* The goal's mark, wearing what the plan and the minimap wear: the story a
   solid brass diamond, an errand an open brass square. Pinned to an edge while
   it is behind the player. */
.gb-compass-mark {
  position: absolute;
  top: 3px;
  width: 10px;
  height: 10px;
  background: var(--gb-accent);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.8);
  transform: translateX(-50%) rotate(45deg);
  transition: left 80ms linear;
}
.gb-compass-mark[data-line='side'] {
  width: 9px;
  height: 9px;
  top: 4px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid var(--gb-accent);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.8);
  transform: translateX(-50%);
}
.gb-compass-mark[data-edge] { opacity: 0.6; }
.gb-compass-where {
  display: flex;
  align-items: baseline;
  gap: var(--gb-s2);
  margin-top: 3px;
  padding: 0 var(--gb-s2);
  font-family: var(--gb-display);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--gb-ink);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
.gb-compass-where .gb-num { color: var(--gb-accent); }
.gb-compass-where[data-line='main'] .gb-what { color: var(--gb-accent); }
`

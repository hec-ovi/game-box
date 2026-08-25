/**
 * The map: the plan fills the frame edge to edge, with the tools in one corner
 * and the bearings along the foot laid over it. Plots scale with the zoom;
 * the marks and the names are drawn in pixels, so they are the same size at
 * every zoom and the plan is read by zooming into it.
 */
export const MAP = `
.gb-window-body[data-face='map'] { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.gb-map { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; outline: none; }
.gb-map:focus-visible { box-shadow: inset 0 0 0 2px var(--gb-accent); }
.gb-plan {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--gb-well);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.gb-plan[data-dragging='true'] { cursor: grabbing; }
.gb-plan svg { display: block; width: 100%; height: 100%; }
.gb-plan .gb-ground { fill: rgba(242, 239, 230, 0.07); }
.gb-plan .gb-block { stroke: rgba(0, 0, 0, 0.5); stroke-width: 1; vector-effect: non-scaling-stroke; }
.gb-plan .gb-block[data-prominence='background'] { fill: var(--gb-plot); }
.gb-plan .gb-block[data-prominence='notable'] { fill: var(--gb-plot-notable); }
.gb-plan .gb-block[data-prominence='landmark'] { fill: var(--gb-plot-landmark); }
.gb-plan text {
  font-family: var(--gb-display);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  paint-order: stroke fill;
  stroke: rgba(0, 0, 0, 0.85);
  stroke-width: 3px;
  stroke-linejoin: round;
  pointer-events: none;
}
.gb-plan .gb-name text { fill: var(--gb-ink); }
.gb-plan .gb-you path { fill: var(--gb-ink); stroke: rgba(0, 0, 0, 0.7); stroke-width: 1.2; }
/* The story's mark is a diamond, an errand's a dot, both brass; the name sits beside each. */
.gb-plan .gb-goal path, .gb-plan .gb-goal circle { fill: var(--gb-accent); stroke: rgba(0, 0, 0, 0.7); stroke-width: 1.2; }
.gb-plan .gb-goal[data-line='side'] circle { fill: var(--gb-accent-deep); stroke: var(--gb-accent); }
.gb-plan .gb-goal text { fill: var(--gb-accent); }
/* A station is a square of ink: the one mark that is neither the player nor a goal. */
.gb-plan .gb-station rect { fill: var(--gb-ink); stroke: rgba(0, 0, 0, 0.7); stroke-width: 1.2; }
.gb-plan .gb-station text { fill: var(--gb-dim); }

.gb-map-tools {
  position: absolute;
  top: var(--gb-s3);
  right: var(--gb-s3);
  display: flex;
  gap: 1px;
  background: rgba(0, 0, 0, 0.55);
  box-shadow: var(--gb-frame);
}
.gb-map-tool {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--gb-s1) var(--gb-s2);
  border: none;
  background: var(--gb-panel);
  color: var(--gb-dim);
  font: inherit;
  cursor: pointer;
  transition: background var(--gb-t) var(--gb-ease), color var(--gb-t) var(--gb-ease);
}
.gb-map-tool:hover { background: var(--gb-lift); color: var(--gb-ink); }

/* The foot of the plan: the places to head for, and beside them the stations. */
.gb-map-foot {
  flex: none;
  display: flex;
  max-height: 132px;
  border-top: 1px solid var(--gb-edge);
  background: var(--gb-solid);
}
.gb-map-foot > section {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: var(--gb-s2) var(--gb-s5) var(--gb-s3);
  scrollbar-width: thin;
  scrollbar-color: var(--gb-accent-deep) transparent;
}
.gb-map-foot > section + section { border-left: 1px solid var(--gb-edge); }
.gb-map-foot h3 { margin-bottom: var(--gb-s1); color: var(--gb-faint); }
.gb-stations li { display: flex; align-items: center; gap: var(--gb-s2); padding: 2px 0; }
.gb-stations li::before { content: '■'; flex: none; width: 12px; color: var(--gb-ink); font-size: 9px; text-align: center; }
.gb-stations .gb-what { flex: 1; }
.gb-station-list .gb-note { margin-top: var(--gb-s1); font-size: 12px; color: var(--gb-faint); }
.gb-travel {
  padding: 2px var(--gb-s2);
  border: 1px solid var(--gb-accent-deep);
  background: transparent;
  color: var(--gb-accent);
  font-family: var(--gb-display);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease),
    color var(--gb-t) var(--gb-ease);
}
.gb-travel:hover { border-color: var(--gb-accent); background: var(--gb-accent); color: var(--gb-accent-ink); }
.gb-bearings li {
  display: flex;
  align-items: baseline;
  gap: var(--gb-s2);
  padding: 2px 0;
}
.gb-bearings li::before { content: '●'; flex: none; width: 12px; color: var(--gb-accent-deep); font-size: 9px; text-align: center; }
.gb-bearings li[data-line='main']::before { content: '◆'; color: var(--gb-accent); font-size: 11px; }
.gb-bearings .gb-what { flex: 1; }
.gb-bearings .gb-bearing {
  padding: 0;
  border: none;
  border-bottom: 1px solid var(--gb-edge);
  background: transparent;
  color: var(--gb-ink);
  font: inherit;
  cursor: pointer;
  transition: color var(--gb-t) var(--gb-ease), border-color var(--gb-t) var(--gb-ease);
}
.gb-bearings .gb-bearing:hover { color: var(--gb-accent); border-bottom-color: var(--gb-accent); }
.gb-bearings .gb-note { color: var(--gb-accent); font-size: 12px; }
`

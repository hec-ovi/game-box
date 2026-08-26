/**
 * The map: the plan fills the frame edge to edge, with the tools in one corner
 * and the two lists along the foot. Plots scale with the zoom; the marks and
 * the names are drawn in pixels, so they are the same size at every zoom and
 * the plan is read by zooming into it.
 */
export const MAP = `
.gb-hud .gb-window-body[data-face='map'] { display: flex; flex-direction: column; padding: 0; overflow: hidden; height: 100%; }
.gb-hud .gb-map { position: relative; display: flex; flex-direction: row; flex: 1; min-height: 0; width: 100%; height: 100%; }
.gb-hud .gb-map:focus-visible { box-shadow: inset 0 0 0 2px var(--gb-accent); }
.gb-hud .gb-plan {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--gb-well);
  cursor: grab;
  touch-action: none;
  user-select: none;
  height: 100%;
}
.gb-hud .gb-plan[data-dragging='true'] { cursor: grabbing; }
/* The plan itself fills the frame; an icon inside a tool over it does not. */
.gb-hud .gb-plan > svg { display: block; width: 100%; height: 100%; }
.gb-hud .gb-plan .gb-ground { fill: var(--gb-void); }
.gb-hud .gb-plan text {
  paint-order: stroke fill;
  stroke: var(--gb-void);
  stroke-width: 3px;
  stroke-linejoin: round;
  pointer-events: none;
}
.gb-hud .gb-plan .gb-name text { fill: var(--gb-dim); }
/* The player, the work and the doorways are drawn by the shared mark rules;
   only the name written beside a mark belongs to the plan. */
.gb-hud .gb-plan .gb-mark text { fill: var(--gb-quest-side); }
.gb-hud .gb-plan .gb-mark[data-line='main'] text { fill: var(--gb-quest-main); }
.gb-hud .gb-plan .gb-mark-home text { fill: var(--gb-accent-lit); }
/* A station is a square of ink: the one mark that is neither the player nor a goal. */
.gb-hud .gb-plan .gb-station rect { fill: var(--gb-ink); stroke: var(--gb-void); stroke-width: 1.2; }
.gb-hud .gb-plan .gb-station text { fill: var(--gb-dim); }

.gb-hud .gb-map-tools {
  position: absolute;
  top: var(--gb-s3);
  right: var(--gb-s3);
  display: flex;
  gap: var(--gb-s1);
  z-index: 5;
}
.gb-hud .gb-map-tool { --gb-face: var(--gb-panel); }

/* Left and Right Sidebars of the map */
.gb-hud .gb-map-sidebar {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s4);
  padding: var(--gb-s4);
  background: var(--gb-well);
  overflow-y: auto;
}
.gb-hud .gb-map-sidebar-left {
  width: 320px;
  border-right: 1px solid var(--gb-edge);
}
.gb-hud .gb-map-main-area {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.gb-hud .gb-map-sidebar-right {
  width: 260px;
  border-left: 1px solid var(--gb-edge);
}
.gb-hud .gb-map-sidebar h3 { margin-bottom: var(--gb-s2); color: var(--gb-faint); font-weight: 700; }
.gb-hud .gb-map-sidebar .gb-empty, .gb-hud .gb-map-sidebar .gb-note { color: var(--gb-faint); }
.gb-hud .gb-station-list .gb-note { margin-top: var(--gb-s2); }

/* The bearings wear the plan's own marks */
.gb-hud .gb-bearings .gb-tile { color: var(--gb-accent); }
.gb-hud .gb-bearings .gb-tile-main { color: var(--gb-main); }
.gb-hud .gb-bearings .gb-tile-main .gb-icon { fill: currentColor; }
.gb-hud .gb-bearing {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--gb-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-bearing:hover, .gb-hud .gb-bearing:focus-visible { color: var(--gb-accent-lit); }

/* The parts of the city. They are the reading you take standing back from it,
   so they fade out as the plan is zoomed into a street. */
.gb-hud .gb-districts, .gb-hud .gb-district-names {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--gb-t-state) var(--gb-in);
}
.gb-hud .gb-plan svg[data-districts='true'] .gb-districts { opacity: 1; pointer-events: auto; }
.gb-hud .gb-plan svg[data-districts='true'] .gb-district-names { opacity: 1; }

.gb-hud .gb-district-fill {
  fill: var(--gb-plot);
  opacity: 0.5;
}
.gb-hud .gb-district-edge {
  fill: none;
  stroke: var(--gb-accent);
  stroke-width: 1.5;
  opacity: 0.55;
  vector-effect: non-scaling-stroke;
}
.gb-hud .gb-district { cursor: pointer; }
/* Under the pointer: that one lights and the rest step back, so which shape it
   is reads even where two of them interlock. */
.gb-hud .gb-plan svg[data-over] .gb-district-fill { opacity: 0.25; }
.gb-hud .gb-plan svg[data-over] .gb-district-edge { opacity: 0.28; }
.gb-hud .gb-plan svg[data-over] .gb-district-name { opacity: 0.35; }
.gb-hud .gb-district:hover .gb-district-fill { fill: var(--gb-accent-glow); opacity: 0.75; }
.gb-hud .gb-district:hover .gb-district-edge { stroke: var(--gb-accent-lit); opacity: 1; }
.gb-hud .gb-plan svg[data-over] .gb-district-name[data-district] { transition: opacity var(--gb-t-press) var(--gb-in); }

.gb-hud .gb-district-name text {
  fill: var(--gb-accent-lit);
  font-family: var(--gb-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  paint-order: stroke fill;
  stroke: var(--gb-void);
  stroke-width: 3;
  pointer-events: none;
}

/* Icon explanation guide on the left sidebar */
.gb-hud .gb-map-legend-guide {
  display: flex;
  flex-direction: column;
}
.gb-hud .gb-legend-guide-list { display: flex; flex-direction: column; gap: var(--gb-s2); }
.gb-hud .gb-legend-guide-item {
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  color: var(--gb-dim);
}
.gb-hud .gb-legend-guide-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
`

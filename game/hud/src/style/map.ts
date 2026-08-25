/**
 * The map: the plan fills the frame edge to edge, with the tools in one corner
 * and the two lists along the foot. Plots scale with the zoom; the marks and
 * the names are drawn in pixels, so they are the same size at every zoom and
 * the plan is read by zooming into it.
 */
export const MAP = `
.gb-hud .gb-window-body[data-face='map'] { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.gb-hud .gb-map { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; }
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
/* The player, the goals and the doorways are drawn by the shared mark rules;
   only the name beside a goal belongs to the plan. */
.gb-hud .gb-plan .gb-goal[data-line='main'] text { fill: var(--gb-main); }
.gb-hud .gb-plan .gb-goal text { fill: var(--gb-accent); }
/* A station is a square of ink: the one mark that is neither the player nor a goal. */
.gb-hud .gb-plan .gb-station rect { fill: var(--gb-ink); stroke: var(--gb-void); stroke-width: 1.2; }
.gb-hud .gb-plan .gb-station text { fill: var(--gb-dim); }

.gb-hud .gb-map-tools {
  position: absolute;
  top: var(--gb-s3);
  right: var(--gb-s3);
  display: flex;
  gap: var(--gb-s1);
}
.gb-hud .gb-map-tool { --gb-face: var(--gb-panel); }

/* The foot of the plan: the places to head for, and beside them the stations. */
.gb-hud .gb-map-foot {
  flex: none;
  display: flex;
  max-height: 150px;
  background: var(--gb-solid);
  box-shadow: inset 0 1px 0 var(--gb-edge);
}
.gb-hud .gb-map-foot > section {
  flex: 1;
  min-width: 0;
  padding: var(--gb-s3) var(--gb-s4);
}
.gb-hud .gb-map-foot > section + section { box-shadow: inset 1px 0 0 var(--gb-edge); }
.gb-hud .gb-map-foot h3 { margin-bottom: var(--gb-s2); color: var(--gb-faint); }
.gb-hud .gb-map-foot .gb-empty, .gb-hud .gb-map-foot .gb-note { color: var(--gb-faint); }
.gb-hud .gb-station-list .gb-note { margin-top: var(--gb-s2); }
/* The bearings wear the plan's own marks: a filled brass diamond on the story,
   an open cyan ring on an errand. */
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
`

/**
 * The map: the city fills the middle of the frame, drawn by the game, with the
 * callouts over it; what the player picked reads down the left and everything
 * there is to read folds down the right.
 *
 * A callout is a line off the thing, a kink, and a small box with its name in
 * it. The line is drawn once per frame the game gives; the box moves by
 * `transform` alone, so a camera turning never lays the page out again.
 */
export const MAP = `
.gb-hud .gb-window-body[data-face='map'] { display: flex; flex-direction: column; padding: 0; overflow: hidden; height: 100%; }
.gb-hud .gb-map { position: relative; display: flex; flex-direction: row; flex: 1; min-height: 0; width: 100%; height: 100%; }
.gb-hud .gb-map:focus-visible { box-shadow: inset 0 0 0 2px var(--gb-accent); }

/* The middle: the glass, and the four tools over its corner. */
.gb-hud .gb-map-middle {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--gb-void);
}
.gb-hud .gb-map-glass {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}
/* Out of the flow: a canvas carries the size of its drawing buffer as its own
   intrinsic size, so a canvas in the flow grows the box it is measured against
   and the two chase each other bigger every frame. */
.gb-hud .gb-map-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; cursor: grab; }
.gb-hud .gb-map-canvas:active { cursor: grabbing; }
.gb-hud .gb-map-tools {
  position: absolute;
  top: var(--gb-s3);
  right: var(--gb-s3);
  display: flex;
  gap: var(--gb-s1);
  z-index: 5;
}
.gb-hud .gb-map-tool { --gb-face: var(--gb-panel); }

/* The callouts. The layer takes no clicks; the boxes on it do. */
.gb-hud .gb-callouts { position: absolute; inset: 0; pointer-events: none; }
.gb-hud .gb-callout-lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.gb-hud .gb-callout-leader {
  fill: none;
  stroke: var(--gb-accent);
  stroke-width: 1;
  opacity: 0.8;
}
.gb-hud .gb-callout-mark { fill: var(--gb-accent); stroke: var(--gb-void); stroke-width: 1.5; paint-order: stroke fill; }
.gb-hud .gb-callout-line[data-kind='goal'] .gb-callout-leader,
.gb-hud .gb-callout-line[data-kind='offer'] .gb-callout-leader { stroke: var(--gb-quest-side); }
.gb-hud .gb-callout-line[data-kind='goal'] .gb-callout-mark,
.gb-hud .gb-callout-line[data-kind='offer'] .gb-callout-mark { fill: var(--gb-quest-side); }
.gb-hud .gb-callout-line[data-line='main'] .gb-callout-leader { stroke: var(--gb-quest-main); }
.gb-hud .gb-callout-line[data-line='main'] .gb-callout-mark { fill: var(--gb-quest-main); }
.gb-hud .gb-callout-line[data-kind='station'] .gb-callout-leader { stroke: var(--gb-dim); }
.gb-hud .gb-callout-line[data-kind='station'] .gb-callout-mark { fill: var(--gb-ink); }
.gb-hud .gb-callout-line[data-kind='home'] .gb-callout-leader,
.gb-hud .gb-callout-line[data-kind='home'] .gb-callout-mark { stroke: var(--gb-accent-lit); fill: var(--gb-accent-lit); }
.gb-hud .gb-callout-line[data-kind='district'] .gb-callout-leader { stroke: var(--gb-accent-dim); }
.gb-hud .gb-callout-line[data-kind='district'] .gb-callout-mark { fill: var(--gb-accent-dim); }

.gb-hud .gb-callout-boxes { position: absolute; inset: 0; }
.gb-hud .gb-callout-box {
  --cut: var(--gb-cut-chip);
  --gb-line: var(--gb-edge);
  position: absolute;
  top: 0;
  left: 0;
  padding: 0;
  border: none;
  background: var(--gb-line);
  color: var(--gb-ink);
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
  transition: color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-callout-box[data-shown='false'] { visibility: hidden; pointer-events: none; }
.gb-hud .gb-callout-face {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 1px;
  padding: 3px 8px;
  background: var(--gb-solid);
  clip-path: inherit;
  color: inherit;
}
.gb-hud .gb-callout-box .gb-icon { flex: none; color: var(--gb-accent); }
.gb-hud .gb-callout-box[data-kind='goal'] .gb-icon, .gb-hud .gb-callout-box[data-kind='offer'] .gb-icon { color: var(--gb-quest-side); }
.gb-hud .gb-callout-box[data-line='main'] .gb-icon { color: var(--gb-quest-main); }
.gb-hud .gb-callout-box[data-line='main'] { --gb-line: var(--gb-main-dim); }
.gb-hud .gb-callout-box[data-kind='home'] .gb-icon { color: var(--gb-accent-lit); }
.gb-hud .gb-callout-box[data-kind='station'] .gb-icon { color: var(--gb-ink); }
.gb-hud .gb-callout-box[data-kind='district'] { --gb-line: var(--gb-accent-dim); }
.gb-hud .gb-callout-box[data-kind='district'] .gb-icon { color: var(--gb-accent-dim); }
.gb-hud .gb-callout-box:hover, .gb-hud .gb-callout-box:focus-visible { --gb-line: var(--gb-edge-lit); color: var(--gb-accent-lit); }
.gb-hud .gb-callout-box[data-on='true'] { --gb-line: var(--gb-accent); color: var(--gb-accent-lit); }

/* The two columns beside it. */
.gb-hud .gb-map-reading, .gb-hud .gb-map-work {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s3);
  padding: var(--gb-s4);
  background: var(--gb-well);
  overflow-y: auto;
}
.gb-hud .gb-map-reading { width: 320px; border-right: 1px solid var(--gb-edge); }
.gb-hud .gb-map-work { width: 360px; border-left: 1px solid var(--gb-edge); }
.gb-hud .gb-map-reading > h3 { color: var(--gb-faint); font-weight: 700; }
.gb-hud .gb-map-reading .gb-empty, .gb-hud .gb-map-work .gb-empty, .gb-hud .gb-map-work .gb-note { color: var(--gb-faint); }

/* What the player picked. */
.gb-hud .gb-map-read { display: flex; flex-direction: column; gap: var(--gb-s3); }
.gb-hud .gb-map-read-head { display: flex; align-items: center; gap: var(--gb-s3); }
.gb-hud .gb-map-read-head .gb-tile { color: var(--gb-accent); }
.gb-hud .gb-map-read[data-line='main'] .gb-map-read-head .gb-tile { color: var(--gb-main); }
.gb-hud .gb-map-read-words { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gb-hud .gb-map-read-kind { color: var(--gb-faint); }
.gb-hud .gb-map-read-name { color: var(--gb-ink); }
.gb-hud .gb-map-read-text { color: var(--gb-dim); }
.gb-hud .gb-map-facts { display: flex; flex-direction: column; }
.gb-hud .gb-map-fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gb-s3);
  padding: 6px 0;
  border-top: 1px solid var(--gb-edge);
}
.gb-hud .gb-map-fact dt { color: var(--gb-faint); }
.gb-hud .gb-map-fact dd { color: var(--gb-ink); text-align: right; }

/* Everything there is to read, under three headings that fold. */
.gb-hud .gb-map-section { display: flex; flex-direction: column; }
.gb-hud .gb-map-section-head {
  --cut: var(--gb-cut-row);
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  height: 34px;
  padding: 0 var(--gb-s2);
  border: none;
  background: var(--gb-lift);
  color: var(--gb-dim);
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-map-section-head:hover, .gb-hud .gb-map-section-head:focus-visible { color: var(--gb-ink); }
.gb-hud .gb-map-section-title { flex: 1; text-align: left; }
.gb-hud .gb-map-section-count { color: var(--gb-faint); }
.gb-hud .gb-map-section-chevron {
  display: inline-flex;
  color: var(--gb-accent);
  transition: transform var(--gb-t-state) var(--gb-in);
}
.gb-hud .gb-map-section[data-open='false'] .gb-map-section-chevron { transform: rotate(-90deg); }
.gb-hud .gb-map-section-body { padding: var(--gb-s2) 0 var(--gb-s3); }
.gb-hud .gb-map-steps { padding: var(--gb-s2) 0 0 var(--gb-s2); }
.gb-hud .gb-map-steps .gb-step-upcoming .gb-step-mark::before { content: none; }
.gb-hud .gb-map-steps .gb-step-upcoming .gb-step-mark { color: var(--gb-faint); }
.gb-hud .gb-map-step-at { margin-left: auto; color: var(--gb-accent); }
.gb-hud .gb-station-list .gb-note { margin-top: var(--gb-s2); }

/* A row whose title is what the player clicks. It clips like the cell it
   replaces: a long job name ends in an ellipsis rather than running under the
   tag beside it. */
.gb-hud .gb-map-pick {
  display: block;
  max-width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-map-pick:hover, .gb-hud .gb-map-pick:focus-visible { color: var(--gb-accent-lit); }
`

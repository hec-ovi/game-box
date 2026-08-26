import { LAYERS } from './layout.ts'

/**
 * A city being written, or a ride between stations. It covers the view, so
 * nothing half-built shows under it, and lists the stages with the one under
 * way marked and the finished ones ticked; a veil has no stages and carries
 * its title alone.
 */
export const LOADER = `
.gb-hud .gb-loader {
  position: absolute;
  inset: 0;
  z-index: ${LAYERS.loader};
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gb-void);
  pointer-events: auto;
}
.gb-hud .gb-loader-card {
  width: min(520px, calc(100% - 96px));
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gb-hud .gb-loader-radar {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--gb-s5);
}
.gb-hud .gb-radar-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.gb-hud .gb-radar-track {
  fill: none;
  stroke: var(--gb-well);
  stroke-width: 2;
}
.gb-hud .gb-radar-track-outer {
  stroke: var(--gb-panel);
  stroke-width: 1.5;
}
.gb-hud .gb-radar-track-mid {
  stroke: var(--gb-well);
  stroke-width: 2.5;
}
.gb-hud .gb-radar-track-inner {
  stroke: var(--gb-lift);
  stroke-width: 2;
}

/* Outer cyan arc */
.gb-hud .gb-radar-arc-outer-cyan {
  fill: none;
  stroke: var(--gb-edge-lit);
  stroke-width: 6;
  stroke-linecap: square;
  stroke-dasharray: 60 270;
  stroke-dashoffset: 0;
  transform-origin: 60px 60px;
  animation: gb-orb-spin 3s linear infinite;
}
/* Outer amber arc */
.gb-hud .gb-radar-arc-outer-amber {
  fill: none;
  stroke: var(--gb-accent);
  stroke-width: 6;
  stroke-linecap: square;
  stroke-dasharray: 40 290;
  stroke-dashoffset: -160;
  transform-origin: 60px 60px;
  animation: gb-orb-spin 3s linear infinite;
}
/* Middle cyan arc */
.gb-hud .gb-radar-arc-mid {
  fill: none;
  stroke: var(--gb-edge-accent);
  stroke-width: 8;
  stroke-linecap: square;
  stroke-dasharray: 100 160;
  stroke-dashoffset: -30;
  transform-origin: 60px 60px;
  animation: gb-radar-spin-ccw 4.5s linear infinite;
}
/* Inner amber thick glowing arc */
.gb-hud .gb-radar-arc-inner {
  fill: none;
  stroke: var(--gb-accent-lit);
  stroke-width: 9;
  stroke-linecap: square;
  stroke-dasharray: 85 105;
  stroke-dashoffset: 0;
  transform-origin: 60px 60px;
  animation: gb-orb-spin 2.2s linear infinite;
}

.gb-hud .gb-radar-percent {
  font-family: var(--gb-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--gb-accent);
  letter-spacing: 0.05em;
  z-index: 1;
}

.gb-hud .gb-loader-card h2 {
  margin-bottom: var(--gb-s6);
  color: var(--gb-ink);
  text-align: center;
}
.gb-hud .gb-loader[data-veil='true'] .gb-loader-card h2 { margin: 0; }
/* The rows are as wide as the bar under them, so a stage reads as one thing. */
.gb-hud .gb-stages { width: 220px; display: flex; flex-direction: column; gap: var(--gb-s4); }
.gb-hud .gb-stage-line { display: flex; align-items: center; gap: var(--gb-s2); margin-bottom: 6px; }
.gb-hud .gb-stage-line .gb-what { flex: 1; min-width: 0; }
.gb-hud .gb-stage-line .gb-num { color: var(--gb-dim); }
/* The mark in front of a stage: a diamond while it runs, a tick once it is done. */
.gb-hud .gb-stage-mark { display: flex; width: 14px; height: 14px; align-items: center; justify-content: center; }
.gb-hud .gb-stage[data-state='waiting'] { color: var(--gb-faint); }
.gb-stage[data-state='waiting'] .gb-stage-mark::before,
.gb-hud .gb-stage[data-state='running'] .gb-stage-mark::before {
  content: '';
  width: 6px;
  height: 6px;
  background: currentColor;
  transform: rotate(45deg);
}
.gb-hud .gb-stage[data-state='running'] { color: var(--gb-accent); }
.gb-hud .gb-stage[data-state='done'] { color: var(--gb-good); }
.gb-hud .gb-stage[data-state='done'] .gb-what { color: var(--gb-dim); }
`

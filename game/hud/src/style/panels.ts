import { CORNER_RESERVED, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * The two things that stay on screen while the player walks: what they are
 * meant to be doing, in the corner, and what the thing in front of them would
 * do, low and central. Neither crosses the view, and neither takes a click.
 */
export const PANELS = `
.gb-hud .gb-objectives {
  position: absolute;
  z-index: ${LAYERS.corner};
  left: ${LAYOUT.margin}px;
  top: ${LAYOUT.margin}px;
  width: ${LAYOUT.corner.width}px;
  max-height: min(42vh, ${LAYOUT.corner.height}px, calc(100vh - ${CORNER_RESERVED}px));
}
/* The head is the panel's label plate: it stays put while the steps scroll. */
.gb-hud .gb-objectives-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s3);
  background: var(--gb-lift) var(--gb-hatch);
  box-shadow: inset 0 -1px 0 var(--gb-edge);
  color: var(--gb-faint);
}
.gb-hud .gb-objectives-line { display: flex; color: var(--gb-accent); }
.gb-hud .gb-objectives[data-line='main'] .gb-objectives-line { color: var(--gb-main); }
.gb-hud .gb-objectives .gb-quest { flex: 1; min-width: 0; color: var(--gb-ink); text-align: right; }
.gb-hud .gb-objectives ul { padding: var(--gb-s2) var(--gb-s3); }
.gb-hud .gb-objectives li {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gb-s1) var(--gb-s2);
  padding: var(--gb-s1) 0 var(--gb-s1) var(--gb-s3);
  color: var(--gb-ink);
}
.gb-hud .gb-objectives li + li { box-shadow: inset 0 1px 0 var(--gb-edge); }
.gb-hud .gb-objectives li[data-optional='true'] .gb-what { color: var(--gb-dim); }
/* The pointer on the step the player is standing on: a cut square, not a bullet. */
.gb-hud .gb-objectives .gb-pip {
  position: absolute;
  left: 0;
  top: 11px;
  width: 6px;
  height: 6px;
  background: var(--gb-accent);
  transform: rotate(45deg);
}
.gb-hud .gb-objectives[data-line='main'] .gb-pip { background: var(--gb-main); }
.gb-hud .gb-objectives .gb-what { flex: 1; min-width: 0; }
.gb-hud .gb-objectives .gb-count { flex: none; color: var(--gb-accent); }
.gb-hud .gb-objectives .gb-decide { display: flex; align-items: center; gap: var(--gb-s1); }
.gb-hud .gb-objectives .gb-hint-line { width: 100%; color: var(--gb-faint); }
.gb-hud .gb-objectives .gb-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s3) var(--gb-s3);
  box-shadow: inset 0 1px 0 var(--gb-edge);
  color: var(--gb-faint);
}

/* NPC Caller Avatar Card (shown in top-left corner replacing objectives during conversation) */
.gb-hud .gb-objectives[data-mode='caller'] {
  --gb-line: var(--gb-accent);
  box-shadow: 0 0 16px var(--gb-edge-lit);
  background: var(--gb-solid);
  max-height: none;
  width: 170px;
}
.gb-hud .gb-objectives[data-mode='caller'] .gb-caller-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gb-s2);
  padding: var(--gb-s3);
}
.gb-hud .gb-caller-avatar-box {
  width: 140px;
  height: 140px;
  background: var(--gb-well);
  border: 1px solid var(--gb-edge-accent);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* The face the game drew, and the silhouette for whoever it has not drawn yet. */
.gb-hud .gb-caller-face {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.gb-hud .gb-portrait-svg { width: 100%; height: 100%; }
.gb-hud .gb-portrait-head, .gb-hud .gb-portrait-shoulders {
  fill: none;
  stroke: var(--gb-dim);
  stroke-width: 2.5;
}
/* The frame, over whichever of the two is inside it. */
.gb-hud .gb-portrait-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.gb-hud .gb-portrait-edge { fill: none; stroke: var(--gb-edge-accent); stroke-width: 1.5; }
.gb-hud .gb-portrait-corner { fill: none; stroke: var(--gb-accent); stroke-width: 2; }
.gb-hud .gb-caller-name {
  color: var(--gb-accent-lit);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: center;
  margin: 4px 0 2px;
}
.gb-hud .gb-caller-voice-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 20px;
  width: 100%;
}
.gb-hud .gb-v-bar {
  width: 3px;
  height: 8px;
  background: var(--gb-accent);
}
/* The bars move only while a line is on its way, so a still panel is a still panel. */
.gb-hud .gb-caller-voice-wave[data-speaking='true'] .gb-v-bar {
  animation: gb-voice-bar 1.2s ease-in-out infinite alternate;
}
@keyframes gb-voice-bar {
  0% { transform: scaleY(0.4); opacity: 0.5; }
  50% { transform: scaleY(1.6); opacity: 1; }
  100% { transform: scaleY(0.6); opacity: 0.7; }
}

/* "E  [Key] Go into The Copper Wheel", embedded seamlessly into the footer HUD */
.gb-hud .gb-prompt {
  position: absolute;
  z-index: ${LAYERS.bar + 1};
  left: 50%;
  transform: translateX(-50%);
  bottom: ${LAYOUT.margin + 4}px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  padding: 0 var(--gb-s2);
  white-space: nowrap;
  background: transparent;
  pointer-events: none;
}
.gb-hud[data-talk='true'] .gb-prompt { left: calc((100% - ${SIDE_RIGHT}px) / 2); }
.gb-hud .gb-prompt kbd {
  --cut: var(--gb-cut-key);
  --gb-line: var(--gb-accent);
  min-width: 28px;
  height: 28px;
  padding: 0 var(--gb-s2);
  color: var(--gb-accent-lit);
  font-size: 13px;
  font-weight: 900;
  background: var(--gb-solid);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gb-accent);
  box-shadow: 0 0 10px var(--gb-edge-lit);
  animation: gb-key-pulse 1.8s ease-in-out infinite alternate;
}
@keyframes gb-key-pulse {
  0% { transform: scale(1); color: var(--gb-accent); }
  100% { transform: scale(1.08); color: var(--gb-accent-lit); }
}
.gb-hud .gb-prompt-anim-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gb-accent);
  animation: gb-icon-pulse 1.8s ease-in-out infinite alternate;
}
.gb-hud .gb-prompt-anim-icon svg {
  width: 100%;
  height: 100%;
}
@keyframes gb-icon-pulse {
  0% { transform: scale(1); opacity: 0.85; }
  100% { transform: scale(1.12); opacity: 1; color: var(--gb-accent-lit); }
}
.gb-hud .gb-prompt .gb-prompt-text {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--gb-ink);
  animation: gb-prompt-light 2.2s ease-in-out infinite alternate;
}
@keyframes gb-prompt-light {
  0% { opacity: 0.8; color: var(--gb-ink); }
  100% { opacity: 1; color: var(--gb-accent-lit); }
}
`

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

/* "E  Go into The Copper Wheel", low and central, where the eye already is;
   central in what the conversation leaves while one is up. */
.gb-hud .gb-prompt {
  position: absolute;
  z-index: ${LAYERS.corner};
  left: 50%;
  bottom: ${LAYOUT.foot + 36}px;
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  padding: var(--gb-s2) var(--gb-s4);
  white-space: nowrap;
}
.gb-hud[data-talk='true'] .gb-prompt { left: calc((100% - ${SIDE_RIGHT}px) / 2); }
.gb-hud .gb-prompt kbd { --gb-line: var(--gb-accent); min-width: 24px; height: 22px; color: var(--gb-accent); }
`

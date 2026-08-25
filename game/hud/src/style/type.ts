/**
 * The type scale, eight steps, declared once. Everything on screen wears one
 * of these by class, so a size or a tracking is changed here and the whole
 * interface follows.
 *
 * Display carries labels, headers and tabs, always upper case and tracked;
 * body carries prose, dialogue and descriptions; mono carries every number,
 * with tabular figures, so a count that changes never shifts what is beside it.
 */
export const TYPE = `
.gb-hud .gb-t0, .gb-hud .gb-unit, .gb-hud .gb-compass-tick[data-point] {
  font: 600 10px/1.2 var(--gb-display);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.gb-hud .gb-t1, .gb-hud .gb-plan text {
  font: 600 11px/1.2 var(--gb-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.gb-hud .gb-t2 { font: 400 12px/1.45 var(--gb-body); letter-spacing: 0; text-transform: none; }
.gb-hud .gb-t3 { font: 400 13px/1.45 var(--gb-body); letter-spacing: 0; text-transform: none; }
.gb-hud .gb-t4 { font: 600 15px/1.2 var(--gb-body); letter-spacing: 0.02em; text-transform: none; }
.gb-hud .gb-t5 {
  font: 600 17px/1.2 var(--gb-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.gb-hud .gb-t6 {
  font: 600 22px/1.2 var(--gb-display);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.gb-hud .gb-t7 {
  font: 600 30px/1.2 var(--gb-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Every number is monospaced at the size of the text it sits in. */
.gb-hud .gb-num {
  font-family: var(--gb-mono);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* A supporting line is one line, clipped rather than wrapped. */
.gb-hud .gb-clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`

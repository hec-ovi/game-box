/**
 * What both plans draw, painted once so a city cannot come out one way in the
 * window and another in the corner: the buildings, and the marks over them.
 *
 * The two lines of work never wear one shape in two shades. The story is a
 * solid brass diamond, an errand an open cyan ring: shape and fill both
 * differ, so which is which reads at a glance and at any size, and each mark
 * carries a dark edge, so neither disappears over a lit plot or a black street.
 */
export const MARKS = `
/* A building on either plan, in one of three fills: a plot nobody named, one
   worth noticing, and a landmark. */
.gb-hud .gb-block {
  fill: var(--gb-plot);
  stroke: var(--gb-void);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.gb-hud .gb-block[data-prominence='notable'] { fill: var(--gb-plot-notable); }
.gb-hud .gb-block[data-prominence='landmark'] { fill: var(--gb-plot-landmark); }

.gb-hud .gb-mark-main {
  fill: var(--gb-main);
  stroke: var(--gb-void);
  stroke-width: 2.5;
  paint-order: stroke fill;
}
.gb-hud .gb-mark-side {
  fill: var(--gb-void);
  stroke: var(--gb-accent);
  stroke-width: 3;
}
/* A doorway the player has walked through: an open square, ink on the dark. */
.gb-hud .gb-mark-door {
  fill: var(--gb-void);
  stroke: var(--gb-ink);
  stroke-width: 2;
}
/* Where the player is, and which way they are looking. */
.gb-hud .gb-you path {
  fill: var(--gb-accent);
  stroke: var(--gb-void);
  stroke-width: 1.2;
}
/* A goal further out than the panel can show, held at the rim and quieter. */
.gb-hud .gb-goal[data-edge='true'] .gb-mark-side { stroke: var(--gb-accent-dim); }
.gb-hud .gb-goal[data-edge='true'] .gb-mark-main { fill: var(--gb-main-dim); }
`

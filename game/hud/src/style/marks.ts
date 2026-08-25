/**
 * What both plans draw, painted once so a city cannot come out one way in the
 * window and another in the corner: the buildings, and the marks over them.
 *
 * The two lines of work never wear one shape in two shades. The story is a
 * solid brass diamond, an errand an open brass ring: shape and fill both
 * differ, so which is which reads at a glance and at any size, and each mark
 * carries a dark edge and a light one, so neither disappears over a pale
 * daylight plot or a black street.
 */
export const MARKS = `
/* A building on either plan, in one of three fills: a plot nobody named, one
   worth noticing, and a landmark. */
.gb-hud .gb-block {
  fill: var(--gb-plot);
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.gb-hud .gb-block[data-prominence='notable'] { fill: var(--gb-plot-notable); }
.gb-hud .gb-block[data-prominence='landmark'] { fill: var(--gb-plot-landmark); }

.gb-hud .gb-mark-main {
  fill: var(--gb-accent);
  stroke: rgba(0, 0, 0, 0.85);
  stroke-width: 2.5;
  paint-order: stroke fill;
}
.gb-hud .gb-mark-side {
  fill: rgba(0, 0, 0, 0.7);
  stroke: var(--gb-accent);
  stroke-width: 3;
}
/* A doorway the player has walked through: an open square, ink on the dark. */
.gb-hud .gb-mark-door {
  fill: rgba(0, 0, 0, 0.7);
  stroke: var(--gb-ink);
  stroke-width: 2;
}
/* Where the player is, and which way they are looking. */
.gb-hud .gb-you path {
  fill: var(--gb-ink);
  stroke: rgba(0, 0, 0, 0.7);
  stroke-width: 1.2;
}
/* A goal further out than the panel can show, held at the rim. */
.gb-hud .gb-goal[data-edge='true'] { opacity: 0.72; }
`

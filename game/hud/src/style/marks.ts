/**
 * What both plans draw, painted once so a city cannot come out one way in the
 * window and another in the corner: the buildings, and the marks over them.
 *
 * Work is a burning square: orange for the story, yellow for an errand, each
 * over a soft square of the same colour that stands in for a glow. A job the
 * player has taken wears a ring round the square as well, so what is on the
 * board reads apart from what is waiting to be picked up. Every mark carries a
 * dark edge, so none of them disappears over a lit plot or a black street.
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

/* Work: the square, the glow behind it and the ring round a job already taken. */
.gb-hud .gb-mark-quest .gb-mark-core {
  fill: var(--gb-quest-side);
  stroke: var(--gb-void);
  stroke-width: 2;
  paint-order: stroke fill;
}
.gb-hud .gb-mark-quest .gb-mark-halo {
  fill: var(--gb-quest-side-glow);
  stroke: none;
}
.gb-hud .gb-mark-quest .gb-mark-ring {
  fill: none;
  stroke: var(--gb-quest-side);
  stroke-width: 2;
}
.gb-hud .gb-mark-quest[data-line='main'] .gb-mark-core { fill: var(--gb-quest-main); }
.gb-hud .gb-mark-quest[data-line='main'] .gb-mark-halo { fill: var(--gb-quest-main-glow); }
.gb-hud .gb-mark-quest[data-line='main'] .gb-mark-ring { stroke: var(--gb-quest-main); }

/* A place of the player's own. */
.gb-hud .gb-mark-home rect, .gb-hud .gb-mark-home path {
  fill: none;
  stroke: var(--gb-accent-lit);
  stroke-width: 2;
}

/* A doorway the player has walked through: an open square, ink on the dark. */
.gb-hud .gb-mark-door {
  fill: var(--gb-void);
  stroke: var(--gb-ink);
  stroke-width: 2;
}
/* Where the player is, and which way they are looking. */
.gb-hud .gb-mark-you path {
  fill: var(--gb-accent);
  stroke: var(--gb-void);
  stroke-width: 1.2;
}
/* A goal further out than the corner can show, held at its rim and quieter. */
.gb-hud .gb-mark[data-edge='true'] { opacity: 0.55; }
`

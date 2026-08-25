/**
 * The panel language: the chamfer, the two-layer edge, the corner ticks, the
 * header, and the small parts every surface is built from (chip, key cap, icon
 * tile, button, field, progress track). Specify them once here and a panel, a
 * row and a button look the same wherever they are drawn.
 *
 * Corners are cut, never rounded: two opposite corners on the diagonal that
 * faces the middle of the view, so the cut always points at the play area.
 *
 * A border cannot follow a clip path, so an edge is two layers: the element
 * itself painted in the edge colour, and a pseudo-element inset 1px painted in
 * the ground, carrying the same cut 1px smaller. Lighting an edge is one
 * custom property, `--gb-line`; thickening it to 2px is the focus ring, since
 * an outline would be clipped away.
 */
export const SHAPE = `
.gb-hud .gb-cut {
  clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
}
.gb-hud .gb-cut-alt {
  clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
}
/* Both colours are declared here rather than left to a fallback, because a
   custom property inherits: a panel that lights its own edge would otherwise
   light every edge inside it. */
.gb-hud .gb-edged {
  --gb-line: var(--gb-edge);
  --gb-face: var(--gb-panel);
  position: relative;
  isolation: isolate;
  background: var(--gb-line);
}
.gb-hud .gb-edged::before {
  content: '';
  position: absolute;
  inset: 1px;
  z-index: -1;
  background: var(--gb-face);
}
.gb-hud .gb-cut.gb-edged::before {
  clip-path: polygon(
    calc(var(--cut) - 1px) 0, 100% 0, 100% calc(100% - var(--cut) + 1px),
    calc(100% - var(--cut) + 1px) 100%, 0 100%, 0 calc(var(--cut) - 1px)
  );
}
.gb-hud .gb-cut-alt.gb-edged::before {
  clip-path: polygon(
    0 0, calc(100% - var(--cut) + 1px) 0, 100% calc(var(--cut) - 1px),
    100% 100%, calc(var(--cut) - 1px) 100%, 0 calc(100% - var(--cut) + 1px)
  );
}

/* The three depths a thing can sit at, and the drop a frame wears. */
.gb-hud .gb-frame {
  --cut: var(--gb-cut-frame);
  --gb-face: var(--gb-solid);
  filter: var(--gb-frame);
}
.gb-hud .gb-plate {
  --cut: var(--gb-cut-panel);
  --gb-face: var(--gb-panel);
  filter: var(--gb-frame);
}

/* An L of accent inside each square corner. Its own element, because the edge
   has already spent the pseudo-elements. */
.gb-hud .gb-ticks {
  position: absolute;
  inset: 4px;
  pointer-events: none;
  opacity: 0.7;
}
.gb-hud .gb-ticks::before, .gb-hud .gb-ticks::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
}
.gb-hud .gb-ticks::before {
  top: 0;
  right: 0;
  border-top: 1px solid var(--gb-accent);
  border-right: 1px solid var(--gb-accent);
}
.gb-hud .gb-ticks::after {
  bottom: 0;
  left: 0;
  border-bottom: 1px solid var(--gb-accent);
  border-left: 1px solid var(--gb-accent);
}
.gb-hud .gb-cut-alt > .gb-ticks::before {
  right: auto;
  left: 0;
  border-right: none;
  border-left: 1px solid var(--gb-accent);
}
.gb-hud .gb-cut-alt > .gb-ticks::after {
  left: auto;
  right: 0;
  border-left: none;
  border-right: 1px solid var(--gb-accent);
}

/* The header on a panel or a frame: hatch over the raised ground, and a rule
   under it whose first stretch is accent. */
.gb-hud .gb-head {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  height: 38px;
  padding: 0 14px;
  background: var(--gb-lift) var(--gb-hatch);
  color: var(--gb-ink);
}
.gb-hud .gb-head-tall { height: 54px; }
.gb-hud .gb-head::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(to right, var(--gb-accent) 0 48px, var(--gb-edge) 48px);
}
.gb-hud .gb-head-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Focus never rides on an outline: a clip path would cut it away. The edge
   lights and thickens to 2px instead, which is the same ring by other means. */
.gb-hud :focus-visible { outline: none; }
.gb-hud .gb-edged:focus-visible { --gb-line: var(--gb-accent-lit); }
.gb-hud .gb-edged:focus-visible::before { inset: 2px; }

/* A heading over a list of rows, with its rule under it. */
.gb-hud .gb-section-head {
  padding-bottom: var(--gb-s2);
  margin-bottom: var(--gb-s2);
  box-shadow: inset 0 -1px 0 var(--gb-edge);
  color: var(--gb-accent);
  /* A heading never ends a column with its rows in the next one. */
  break-after: avoid;
}

/* "Enter sends, Escape walks away", under the thing it applies to. */
.gb-hud .gb-hints { display: flex; flex-wrap: wrap; gap: var(--gb-s3); margin-top: var(--gb-s3); }
.gb-hud .gb-hint { display: flex; align-items: center; gap: 6px; color: var(--gb-faint); }
.gb-hud .gb-keys { display: flex; gap: 3px; }
`

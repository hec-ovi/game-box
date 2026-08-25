/**
 * The small parts every surface is built from: the chip, the key cap, the icon
 * tile, the button, the field and the bar that fills. Each is chamfered and
 * edged by the panel language, so one of them looks the same wherever it is
 * drawn and a new surface never invents its own.
 */
export const PARTS = `
/* A chip: a word about a thing, in the colour of what it says. */
.gb-hud .gb-chip {
  --cut: var(--gb-cut-chip);
  --gb-face: var(--gb-lift);
  --gb-line: color-mix(in srgb, currentColor 40%, transparent);
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  color: var(--gb-dim);
}
/* The story is filled brass wherever it is marked: one amber thing in a cyan
   field, which is the whole point of the second accent. */
.gb-hud .gb-chip-main {
  --gb-line: var(--gb-main);
  --gb-face: var(--gb-main);
  color: var(--gb-main-ink);
}
.gb-hud .gb-chip-good { color: var(--gb-good); }
.gb-hud .gb-chip-warn { color: var(--gb-warn); }
.gb-hud .gb-chip-bad { color: var(--gb-danger); }
.gb-hud .gb-chip-accent { color: var(--gb-accent); }

/* A key cap: the key the player presses, written where they can see it. */
.gb-hud kbd {
  --cut: var(--gb-cut-chip);
  --gb-face: var(--gb-lift);
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  color: var(--gb-dim);
  font: 500 10px/1 var(--gb-mono);
  font-variant-numeric: tabular-nums;
}

/* An icon tile: the picture on the left of every row. */
.gb-hud .gb-tile {
  --cut: var(--gb-cut-chip);
  --gb-face: var(--gb-lift);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--gb-dim);
}
.gb-hud .gb-tile-sm { width: 26px; height: 26px; }
.gb-hud svg { display: block; flex: none; }

/* A button: lit is the one thing to do here, quiet is everything else. */
.gb-hud .gb-act {
  --cut: var(--gb-cut-row);
  --gb-face: var(--gb-lift);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: none;
  color: var(--gb-ink);
  cursor: pointer;
  pointer-events: auto;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-act:hover:not(:disabled) { --gb-line: var(--gb-edge-lit); color: var(--gb-accent-lit); }
/* The one thing to do here, wearing the halo everything bright wears in this
   city. It is a filter rather than a shadow because the chamfer would clip a
   shadow away, and it never moves. */
.gb-hud .gb-act-lit {
  --gb-line: var(--gb-accent);
  --gb-face: var(--gb-accent);
  color: var(--gb-accent-ink);
  filter: drop-shadow(0 0 5px var(--gb-accent-glow));
}
.gb-hud .gb-act-lit:hover:not(:disabled) {
  --gb-line: var(--gb-accent-lit);
  --gb-face: var(--gb-accent-lit);
  color: var(--gb-accent-ink);
}
.gb-hud .gb-act-warn:hover:not(:disabled) { --gb-line: var(--gb-danger); color: var(--gb-danger); }
.gb-hud .gb-act-armed { --gb-line: var(--gb-danger); --gb-face: var(--gb-danger); color: var(--gb-void); }
.gb-hud .gb-act[aria-pressed='true'] {
  --gb-line: var(--gb-accent);
  --gb-face: var(--gb-accent);
  color: var(--gb-accent-ink);
}
/* Disabled: readable, never hidden, and never still wearing the lit fill. */
.gb-hud .gb-act:disabled {
  --gb-line: var(--gb-off);
  --gb-face: var(--gb-lift);
  color: var(--gb-off-ink);
  cursor: default;
}
.gb-hud .gb-act:disabled kbd { --gb-line: var(--gb-off); color: var(--gb-off-ink); }

/* A field: sunken, with the accent taking its edge while it has the keyboard. */
.gb-hud .gb-field {
  --cut: var(--gb-cut-row);
  --gb-face: var(--gb-well);
  width: 100%;
  padding: 9px 12px;
  border: none;
  color: var(--gb-ink);
  transition: color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-field::placeholder { color: var(--gb-faint); }
.gb-hud .gb-field:focus { --gb-line: var(--gb-accent); outline: none; }

/* A bar that fills: an inner element scaled from the left, never a width. */
.gb-hud .gb-track {
  --cut: 3px;
  --gb-face: var(--gb-well);
  flex: none;
  width: 96px;
  height: 4px;
  overflow: hidden;
}
.gb-hud .gb-track-wide { width: 220px; }
.gb-hud .gb-fill {
  position: absolute;
  inset: 1px;
  z-index: 0;
  background: var(--gb-accent);
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform var(--gb-t-value) var(--gb-in);
}
.gb-hud .gb-track-main .gb-fill { background: var(--gb-main); }
.gb-hud .gb-track-warn .gb-fill { background: var(--gb-warn); }
`

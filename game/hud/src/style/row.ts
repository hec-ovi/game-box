/**
 * The one row. The quest list, the inventory, the codex, the settings, the
 * station list, the counter, the bearings and the controls are all this shape:
 * an icon tile, a title over a supporting line, what state it is in, what can
 * be done about it, and the key that does the same thing.
 *
 * A row with nothing to do is not a button: it does not answer the pointer.
 */
export const ROW = `
.gb-hud .gb-rows { display: flex; flex-direction: column; }
.gb-hud .gb-row {
  --cut: var(--gb-cut-row);
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr auto auto;
  align-items: center;
  gap: 0 var(--gb-s3);
  min-height: 58px;
  padding: 0 var(--gb-s3);
  box-shadow: inset 0 -1px 0 var(--gb-edge);
  transition: transform var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-row:last-child { box-shadow: none; }
.gb-hud .gb-row-compact { min-height: 44px; grid-template-columns: 26px 1fr auto auto; }

/* The accent tab down the left edge: what this row is, in one stroke. */
.gb-hud .gb-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
}
.gb-hud .gb-row[data-line='main']::before { background: var(--gb-main); }
.gb-hud .gb-row[data-line='on']::before { background: var(--gb-accent); }
.gb-hud .gb-row[data-line='bad']::before { background: var(--gb-danger); }

.gb-hud .gb-row-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gb-hud .gb-row-title { color: var(--gb-ink); }
.gb-hud .gb-row-line { color: var(--gb-dim); }
.gb-hud .gb-row-state { display: flex; align-items: center; gap: var(--gb-s2); color: var(--gb-dim); }
.gb-hud .gb-row-acts { display: flex; align-items: center; gap: 6px; }

/* Under the pointer only where there is something to do. */
.gb-hud .gb-row[data-acts='true']:hover { background: var(--gb-lift); transform: translateX(2px); }
.gb-hud .gb-row[data-acts='true']:hover .gb-tile { --gb-line: var(--gb-edge-lit); }
.gb-hud .gb-row[data-line='main'][data-acts='true']:hover .gb-tile { color: var(--gb-main-lit); }

/* Chosen: sunken, edged in accent, the tile lit with it. */
.gb-hud .gb-row[data-on='true'] {
  background: var(--gb-well);
  box-shadow: inset 0 0 0 1px var(--gb-edge-accent);
}
.gb-hud .gb-row[data-on='true'] .gb-tile { --gb-line: var(--gb-edge-accent); color: var(--gb-accent); }
.gb-hud .gb-row[data-on='true'] .gb-row-title { color: var(--gb-ink); }
/* The story is brass wherever it is drawn, followed or not. */
.gb-hud .gb-row[data-line='main'] .gb-tile { --gb-line: var(--gb-main-dim); color: var(--gb-main); }

/* Done: struck through, and quiet. */
.gb-hud .gb-row[data-done='true'] .gb-row-title { color: var(--gb-faint); text-decoration: line-through; }
`

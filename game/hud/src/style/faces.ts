/**
 * The four faces that are lists of rows: the inventory, the codex, the
 * settings and the controls. The row itself is specified once elsewhere; this
 * is only what each face adds to it.
 */
export const FACES = `
/* Inventory: what can be spent, what is in hand, then the places that are the
   player's. Money is read here and in no corner. */
.gb-hud .gb-coin {
  --cut: var(--gb-cut-row);
  --gb-face: var(--gb-well);
  --gb-line: var(--gb-edge-accent);
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  padding: var(--gb-s3) var(--gb-s4);
  margin-bottom: var(--gb-s4);
  color: var(--gb-accent);
}
.gb-hud .gb-coin .gb-unit { color: var(--gb-faint); }
.gb-hud .gb-carried .gb-value { color: var(--gb-dim); }
.gb-hud .gb-homes { margin-top: var(--gb-s5); }
.gb-hud .gb-home { break-inside: avoid; margin-bottom: var(--gb-s3); }
.gb-hud .gb-placed { padding-left: 38px; }

/* Codex: what has been found out, under one heading per kind of thing. */
.gb-hud .gb-codex-group { margin-bottom: var(--gb-s5); }
.gb-hud .gb-codex-group:last-child { margin-bottom: 0; }
.gb-hud .gb-codex-entry { break-inside: avoid; }
.gb-hud .gb-known { color: var(--gb-faint); }
.gb-hud .gb-facts { padding: var(--gb-s1) 0 var(--gb-s3) 38px; }
.gb-hud .gb-facts li { display: flex; align-items: center; gap: var(--gb-s2); padding: 2px 0; color: var(--gb-dim); }
.gb-hud .gb-facts .gb-fact { color: var(--gb-good); }
.gb-hud .gb-facts .gb-fact .gb-what { color: var(--gb-dim); }
/* A locked fact is a line, never a gap: what is still to learn is on the page. */
.gb-hud .gb-facts .gb-fact-locked { color: var(--gb-faint); font-style: italic; }
.gb-hud .gb-note-text { padding: 0 var(--gb-s3) var(--gb-s3) 38px; color: var(--gb-dim); }

/* Settings: the clock, the sky, the view, and the way out. */
.gb-hud .gb-setting { margin-bottom: var(--gb-s5); break-inside: avoid; }
.gb-hud .gb-setting:last-child { margin-bottom: 0; }
.gb-hud .gb-settings .gb-clock { color: var(--gb-ink); }
.gb-hud .gb-weathers { display: flex; flex-wrap: wrap; gap: var(--gb-s1); }
.gb-hud .gb-setting-exit { --gb-line: var(--gb-danger); color: var(--gb-danger); }

/* Controls: what the game says its keys do, then the ones the interface owns. */
.gb-hud .gb-control-group { margin-bottom: var(--gb-s5); break-inside: avoid; }
.gb-hud .gb-control-group:last-child { margin-bottom: 0; }
`

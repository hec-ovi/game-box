/**
 * The four faces that are lists of rows: the inventory, the codex, the
 * settings and the controls. The row itself is specified once elsewhere; this
 * is only what each face adds to it.
 */
export const FACES = `
/* Inventory: 2-column layout (Left: 3D showcase, Right: Items grid) */
.gb-hud .gb-inventory {
  display: flex;
  gap: var(--gb-s5);
  height: 100%;
  min-height: 0;
}
.gb-hud .gb-inv-showcase {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s2);
  padding: var(--gb-s3) var(--gb-s4);
  background: var(--gb-well);
}
.gb-hud .gb-inv-name {
  color: var(--gb-accent);
}
.gb-hud .gb-inv-value {
  color: var(--gb-dim);
}
.gb-hud .gb-inv-desc {
  color: var(--gb-faint);
  flex: 1;
  min-height: 60px;
}
.gb-hud .gb-inv-quest-badge {
  padding: var(--gb-s1) var(--gb-s2);
  background: var(--gb-lift);
  color: var(--gb-main);
  box-shadow: inset 2px 0 0 var(--gb-main);
}
.gb-hud .gb-inv-3d-box {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gb-solid);
  cursor: grab;
  perspective: 600px;
}
.gb-hud .gb-inv-3d-mesh {
  width: 60px;
  height: 60px;
  border: 2px solid var(--gb-accent);
  box-shadow: 0 0 16px var(--gb-edge-lit);
  transform: rotateY(0deg) rotateX(20deg);
  animation: gb-inv-spin 10s linear infinite;
}
@keyframes gb-inv-spin {
  0% { transform: rotateY(0deg) rotateX(20deg); }
  100% { transform: rotateY(360deg) rotateX(20deg); }
}
.gb-hud .gb-inv-right-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s3);
}
.gb-hud .gb-inv-slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--gb-s2);
  margin-bottom: var(--gb-s3);
}
.gb-hud .gb-inv-slot {
  --cut: var(--gb-cut-row);
  height: 60px;
  padding: var(--gb-s2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--gb-well);
  border: 1px solid var(--gb-edge);
  cursor: pointer;
  position: relative;
  transition: background-color var(--gb-t-press) var(--gb-in), color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-inv-slot:hover {
  background: var(--gb-lift);
}
.gb-hud .gb-inv-slot[data-active='true'] {
  background: var(--gb-lift);
  box-shadow: inset 0 0 0 1px var(--gb-accent);
}
.gb-hud .gb-slot-empty {
  opacity: 0.35;
  cursor: default;
}
.gb-hud .gb-slot-empty-num {
  color: var(--gb-faint);
}
.gb-hud .gb-slot-quest-star {
  position: absolute;
  top: 4px;
  right: 6px;
  color: var(--gb-main);
  font-size: 11px;
}
.gb-hud .gb-inv-grid-pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

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

/* Codex: Places & People Split View */
.gb-hud .gb-codex {
  display: flex;
  height: 100%;
  min-height: 0;
}
.gb-hud .gb-codex-split-view {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--gb-s5);
  width: 100%;
}
.gb-hud .gb-codex-list-pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.gb-hud .gb-codex-amplified {
  flex: 0 0 360px;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s2);
  padding: var(--gb-s4);
  background: var(--gb-well);
  border-left: 1px solid var(--gb-edge);
}
.gb-hud .gb-codex-amplified-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gb-solid);
  border: 1px solid var(--gb-edge-accent);
  margin-bottom: var(--gb-s2);
}
.gb-hud .gb-avatar-person { color: var(--gb-good); border-color: var(--gb-good); }
.gb-hud .gb-avatar-door { color: var(--gb-accent); border-color: var(--gb-accent); }
.gb-hud .gb-amplified-sub { color: var(--gb-dim); font-weight: 700; }
.gb-hud .gb-amplified-desc { color: var(--gb-faint); white-space: pre-line; line-height: 1.5; }

.gb-hud .gb-codex-group { margin-bottom: var(--gb-s5); }
.gb-hud .gb-codex-group:last-child { margin-bottom: 0; }
.gb-hud .gb-codex-entry {
  break-inside: avoid;
  cursor: pointer;
  padding: var(--gb-s1) var(--gb-s2);
  transition: background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-codex-entry:hover {
  background: var(--gb-lift);
}
.gb-hud .gb-codex-entry[data-selected='true'] {
  background: var(--gb-lift);
  box-shadow: inset 3px 0 0 var(--gb-accent);
}
.gb-hud .gb-place-entry .gb-tile { color: var(--gb-accent); }
.gb-hud .gb-person .gb-tile { color: var(--gb-good); }
.gb-hud .gb-known { color: var(--gb-faint); }
.gb-hud .gb-person-avatar {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gb-good);
}
.gb-hud .gb-facts { padding: var(--gb-s1) 0 var(--gb-s3) 38px; }
.gb-hud .gb-facts li { display: flex; align-items: center; gap: var(--gb-s2); padding: 2px 0; color: var(--gb-dim); }
.gb-hud .gb-facts .gb-fact { color: var(--gb-good); }
.gb-hud .gb-facts .gb-fact .gb-what { color: var(--gb-dim); }
.gb-hud .gb-facts .gb-fact-locked { color: var(--gb-faint); font-style: italic; }
.gb-hud .gb-note-text { padding: 0 var(--gb-s3) var(--gb-s3) 38px; color: var(--gb-dim); }

/* Settings: the clock, the sky, the view, and the way out. */
.gb-hud .gb-setting { margin-bottom: var(--gb-s5); break-inside: avoid; }
.gb-hud .gb-setting:last-child { margin-bottom: 0; }
.gb-hud .gb-settings .gb-clock { color: var(--gb-ink); }
.gb-hud .gb-weathers { display: flex; flex-wrap: wrap; gap: var(--gb-s1); }
.gb-hud .gb-setting-exit { --gb-line: var(--gb-danger); color: var(--gb-danger); }

/* Controls: Single-page non-scrolling grid layout */
.gb-hud .gb-controls {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--gb-s4);
  align-content: start;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}
.gb-hud .gb-control-group { margin-bottom: 0; break-inside: avoid; }
.gb-hud .gb-control-group:last-child { margin-bottom: 0; }
`

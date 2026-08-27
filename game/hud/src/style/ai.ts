/**
 * The settings tab's other face: the providers and the jobs pointed at them.
 * A provider is the one row with its fields under it, indented to the width of
 * the tile so the row still reads as the thing they belong to.
 */
export const AI_CSS = `
.gb-hud .gb-ai-provider { break-inside: avoid; }
.gb-hud .gb-ai-provider + .gb-ai-provider { margin-top: var(--gb-s3); }
.gb-hud .gb-ai-fields {
  display: flex;
  flex-direction: column;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s3) var(--gb-s3) 60px;
}

/* A field: its caption over the box, with the button that hands it over beside it. */
.gb-hud .gb-ai-field { display: flex; align-items: flex-end; gap: var(--gb-s2); }
.gb-hud .gb-ai-label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gb-s1);
  color: var(--gb-faint);
}

/* A list to pick from. It cannot carry the two-layer edge, because a select
   draws its own inside, so its edge is an inset shadow inside the same cut. */
.gb-hud .gb-pick {
  --cut: var(--gb-cut-row);
  clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  background: var(--gb-well);
  box-shadow: inset 0 0 0 1px var(--gb-edge);
  color: var(--gb-ink);
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-pick:focus { box-shadow: inset 0 0 0 2px var(--gb-accent); outline: none; }
.gb-hud .gb-pick:disabled { color: var(--gb-off-ink); cursor: default; }

.gb-hud .gb-ai-note { color: var(--gb-dim); }

/* What one real call came back with: how long it took over what it said. */
.gb-hud .gb-ai-said {
  display: flex;
  flex-direction: column;
  gap: var(--gb-s1);
  padding: var(--gb-s2) var(--gb-s3);
  background: var(--gb-well);
}
.gb-hud .gb-ai-said-when { color: var(--gb-good); }
.gb-hud .gb-ai-said-bad { color: var(--gb-danger); }
.gb-hud .gb-ai-said-text { color: var(--gb-dim); }

/* A job's row: the list it is pointed at is wide enough to read a name in. */
.gb-hud .gb-ai-job .gb-pick { min-width: 168px; padding: 5px 8px; }
`

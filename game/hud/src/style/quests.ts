/**
 * The quests face: one page per quest, each a row of its own with the steps
 * under it. Four states, three weights: what to do now is loud, what is done
 * is struck through, what the quest went past says so in words.
 */
export const QUESTS = `
.gb-hud .gb-quest-entry {
  --cut: var(--gb-cut-panel);
  break-inside: avoid;
  margin-bottom: var(--gb-s4);
  box-shadow: inset 0 0 0 1px var(--gb-edge);
}
.gb-hud .gb-quest-entry[data-tracked='true'] { box-shadow: inset 0 0 0 1px var(--gb-edge-accent); }
.gb-hud .gb-quest-row { background: var(--gb-lift); box-shadow: inset 0 -1px 0 var(--gb-edge); }
.gb-hud .gb-quest-entry[data-status='complete'] .gb-quest-row, .gb-hud .gb-quest-entry[data-status='failed'] .gb-quest-row {
  background: transparent;
}
/* The steps line up under the title, past the tile the row wears. */
.gb-hud .gb-quest-body { padding: var(--gb-s3) var(--gb-s4) var(--gb-s3) 60px; }
.gb-hud .gb-quest-entry[data-status='failed'] .gb-row-line { color: var(--gb-danger); }

/* The clock on a timed quest, and the share of it left. */
.gb-hud .gb-quest-timer { margin-bottom: var(--gb-s3); color: var(--gb-dim); }
.gb-hud .gb-timer-line { display: flex; align-items: center; gap: var(--gb-s2); margin-bottom: 6px; }
.gb-hud .gb-timer-line .gb-num { color: var(--gb-accent); }
.gb-hud .gb-quest-timer[data-low='true'], .gb-hud .gb-quest-timer[data-low='true'] .gb-num { color: var(--gb-warn); }

.gb-hud .gb-steps li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gb-s2); padding: 3px 0; }
.gb-hud .gb-steps .gb-step-mark { flex: none; display: flex; align-items: center; justify-content: center; width: 14px; }
.gb-hud .gb-steps .gb-what { min-width: 0; }
/* Four states, three weights: what to do now is loud, the rest are quiet. */
.gb-hud .gb-step-open { color: var(--gb-ink); }
.gb-hud .gb-step-open .gb-step-mark::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--gb-accent);
  transform: rotate(45deg);
}
.gb-hud .gb-quest-entry[data-status='active'] .gb-step-open .gb-what { color: var(--gb-ink); }
.gb-hud .gb-step-upcoming { color: var(--gb-dim); }
.gb-hud .gb-step-upcoming .gb-step-mark::before {
  content: '';
  width: 4px;
  height: 4px;
  background: var(--gb-faint);
  transform: rotate(45deg);
}
.gb-hud .gb-step-done { color: var(--gb-good); }
.gb-hud .gb-step-done .gb-what { color: var(--gb-faint); text-decoration: line-through; }
.gb-hud .gb-step-dropped { color: var(--gb-faint); }
.gb-hud .gb-step-dropped .gb-what { color: var(--gb-faint); }

/* A decision: the quest's own question, and one button for each road out. */
.gb-hud .gb-choice { width: 100%; padding: var(--gb-s2) 0 var(--gb-s1) var(--gb-s3); }
.gb-hud .gb-choice .gb-ask { margin-bottom: var(--gb-s2); color: var(--gb-ink); }
.gb-hud .gb-options { display: flex; flex-direction: column; gap: var(--gb-s1); max-width: 520px; }
.gb-hud .gb-option {
  --cut: var(--gb-cut-row);
  --gb-face: var(--gb-lift);
  --gb-line: var(--gb-edge-accent);
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  width: 100%;
  padding: var(--gb-s2) var(--gb-s3);
  border: none;
  color: var(--gb-ink);
  text-align: left;
  cursor: pointer;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-option .gb-what { flex: 1; min-width: 0; }
.gb-hud .gb-option .gb-num { color: var(--gb-accent); }
.gb-hud .gb-option:hover, .gb-hud .gb-option:focus-visible { --gb-line: var(--gb-accent); color: var(--gb-accent-lit); }
`

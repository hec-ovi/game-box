/**
 * The four faces of the window. Each one is a page of text over the street, so
 * they share a reading rhythm: a heading rule, rows separated by hairlines, and
 * brass on the one thing in the row the player is meant to act on or head for.
 */
export const TABS = `
/* Quests: every job under way, and which one the corner panel follows. */
.gb-quest-entry { padding-bottom: var(--gb-s3); margin-bottom: var(--gb-s3); border-bottom: 1px solid var(--gb-edge); }
.gb-quest-entry:last-child { border-bottom: none; margin-bottom: 0; }
.gb-quest-entry[data-tracked='true'] { padding-left: var(--gb-s3); border-left: 3px solid var(--gb-accent); }
.gb-quest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gb-s3);
  margin-bottom: 6px;
}
.gb-quest-head h3 {
  font-family: var(--gb-display);
  font-size: 15px;
  letter-spacing: 0.04em;
  text-transform: none;
  color: var(--gb-ink);
}
.gb-quest-acts { display: flex; flex: none; gap: var(--gb-s1); }
.gb-quest-acts button {
  padding: 3px var(--gb-s2);
  border: 1px solid var(--gb-edge);
  background: transparent;
  color: var(--gb-dim);
  font-family: var(--gb-display);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), color var(--gb-t) var(--gb-ease),
    background var(--gb-t) var(--gb-ease);
}
.gb-track:hover { border-color: var(--gb-accent); color: var(--gb-accent); }
.gb-track[aria-pressed='true'] { border-color: var(--gb-accent); background: var(--gb-accent); color: var(--gb-accent-ink); }
/* Giving up costs the player their progress, so it is warned rather than brass. */
.gb-give-up:hover { border-color: var(--gb-warn); color: var(--gb-warn); }
.gb-give-up[data-armed='true'] { border-color: var(--gb-warn); background: var(--gb-warn); color: var(--gb-ink); }
.gb-quest-entry li { display: flex; flex-wrap: wrap; gap: var(--gb-s2); padding: 2px 0; }
.gb-quest-entry .gb-mark { width: 12px; flex: none; color: var(--gb-accent); text-align: center; }
/* Four states, three weights: what to do now is loud, the rest are quiet. */
.gb-quest-entry .gb-step-open { color: var(--gb-ink); }
.gb-quest-entry .gb-step-upcoming { color: var(--gb-dim); }
.gb-quest-entry .gb-step-upcoming .gb-mark { color: var(--gb-faint); }
.gb-quest-entry .gb-step-done { color: var(--gb-faint); }
.gb-quest-entry .gb-step-done .gb-what { text-decoration: line-through; }
.gb-quest-entry .gb-step-dropped { color: var(--gb-faint); }
.gb-quest-entry .gb-step-dropped .gb-mark { color: var(--gb-faint); }
.gb-quest-entry .gb-tag { flex: none; align-self: center; }

/* A decision: the quest's own question, and one button for each road out. */
.gb-choice { width: 100%; padding: var(--gb-s2) 0 var(--gb-s1) var(--gb-s5); }
.gb-choice .gb-ask { margin-bottom: var(--gb-s2); color: var(--gb-ink); }
.gb-options { display: flex; flex-direction: column; gap: var(--gb-s1); }
.gb-option {
  width: 100%;
  padding: var(--gb-s2) var(--gb-s3);
  border: 1px solid var(--gb-accent-deep);
  background: var(--gb-lift);
  color: var(--gb-accent);
  font-family: var(--gb-body);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease),
    color var(--gb-t) var(--gb-ease);
}
.gb-option:hover, .gb-option:focus-visible { border-color: var(--gb-accent); background: var(--gb-accent); color: var(--gb-accent-ink); }

/* Map: the survey, then where the tracked job points. */
.gb-plan:not(:empty) { margin-bottom: var(--gb-s4); border: 1px solid var(--gb-edge); background: var(--gb-well); }
.gb-plan svg { display: block; width: 100%; max-height: 40vh; }
.gb-plan .gb-ground { fill: rgba(242, 239, 230, 0.07); }
.gb-plan .gb-block { fill: rgba(233, 214, 186, 0.34); }
.gb-plan .gb-you { fill: var(--gb-ink); stroke: rgba(0, 0, 0, 0.7); stroke-width: 0.6; }
.gb-plan .gb-goal circle { fill: var(--gb-accent); stroke: rgba(0, 0, 0, 0.7); stroke-width: 0.6; }
.gb-plan .gb-goal text {
  fill: var(--gb-accent-ink);
  font-family: var(--gb-mono);
  font-size: 2.6px;
  font-weight: 700;
}
.gb-bearing-list h3 { margin-bottom: var(--gb-s2); color: var(--gb-faint); }
.gb-bearings li {
  display: flex;
  align-items: baseline;
  gap: var(--gb-s2);
  padding: var(--gb-s1) 0;
  border-top: 1px solid rgba(242, 239, 230, 0.07);
}
.gb-bearings li:first-child { border-top: none; }
.gb-bearings .gb-pip {
  flex: none;
  width: 18px;
  padding: 0 var(--gb-s1);
  background: var(--gb-accent);
  color: var(--gb-accent-ink);
  font-family: var(--gb-mono);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}
.gb-bearings .gb-what { flex: 1; }
.gb-bearings .gb-note { color: var(--gb-accent); font-size: 12px; }

/* Items: what can be spent, then what is in hand. */
.gb-items .gb-coin {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-bottom: var(--gb-s3);
  margin-bottom: var(--gb-s3);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-items .gb-num { font-size: 30px; color: var(--gb-accent); }
.gb-items .gb-unit { color: var(--gb-faint); }
.gb-carried li { display: flex; align-items: center; gap: var(--gb-s2); padding: var(--gb-s1) 0; }
.gb-carried .gb-mark { width: 12px; flex: none; color: var(--gb-faint); text-align: center; }
.gb-carried .gb-what { flex: 1; }
.gb-carried .gb-quest-item .gb-mark { color: var(--gb-accent); }
.gb-carried .gb-quest-item .gb-tag { border-color: var(--gb-accent-deep); color: var(--gb-accent); }

/* Controls: what the game says its keys do, then the ones the interface owns. */
.gb-control-group { margin-bottom: var(--gb-s4); }
.gb-control-group:last-child { margin-bottom: 0; }
.gb-control-group h3 {
  padding-bottom: var(--gb-s1);
  margin-bottom: var(--gb-s2);
  border-bottom: 1px solid var(--gb-edge);
  color: var(--gb-accent);
}
.gb-control-group .gb-hints { flex-direction: column; gap: var(--gb-s1); margin-top: 0; }
.gb-control-group .gb-hint { font-size: 13px; color: var(--gb-ink); }
.gb-control-group .gb-keys { min-width: 92px; }
`

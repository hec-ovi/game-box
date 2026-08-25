/**
 * The faces of the window that read as pages. Each one is text over the
 * street, so they share a reading rhythm: a heading rule, rows separated by hairlines, and
 * brass on the one thing in the row the player is meant to act on or head for.
 */
export const TABS = `
/* Quests: every job under way, and which one the corner panel follows. */
.gb-quest-entry { padding-bottom: var(--gb-s3); margin-bottom: var(--gb-s3); border-bottom: 1px solid var(--gb-edge); }
.gb-quest-entry:last-child { border-bottom: none; margin-bottom: 0; }
.gb-quest-entry[data-tracked='true'] { padding-left: var(--gb-s3); border-left: 3px solid var(--gb-accent); }
.gb-quest-name { display: flex; align-items: baseline; gap: var(--gb-s2); min-width: 0; }
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
/* A quest that ended reads quiet; one that ended badly says so in warn. */
.gb-quest-entry[data-status='complete'] h3, .gb-quest-entry[data-status='failed'] h3 { color: var(--gb-dim); }
.gb-quest-entry .gb-status-failed { flex: none; border-color: var(--gb-warn); color: var(--gb-warn); }
.gb-quest-entry .gb-status-complete { flex: none; border-color: var(--gb-accent-deep); color: var(--gb-accent); }
.gb-quest-reason { margin-bottom: 6px; padding-left: var(--gb-s2); border-left: 2px solid var(--gb-warn); color: var(--gb-dim); font-size: 13px; }
/* The clock on a timed quest, and the share of it left. */
.gb-quest-timer { margin-bottom: var(--gb-s2); }
.gb-timer-line { display: flex; align-items: center; gap: var(--gb-s2); margin-bottom: var(--gb-s1); }
.gb-quest-timer .gb-num { font-size: 15px; color: var(--gb-accent); }
.gb-quest-timer[data-low='true'] .gb-num, .gb-quest-timer[data-low='true'] .gb-tag { color: var(--gb-warn); border-color: var(--gb-warn); }
.gb-quest-timer[data-low='true'] .gb-bar-fill { background: var(--gb-warn); }
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

/* Inventory: what can be spent, then what is in hand. */
.gb-inventory .gb-coin {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-bottom: var(--gb-s3);
  margin-bottom: var(--gb-s3);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-inventory .gb-num { font-size: 30px; color: var(--gb-accent); }
.gb-inventory .gb-unit { color: var(--gb-faint); }
.gb-carried li { display: flex; align-items: center; gap: var(--gb-s2); padding: var(--gb-s1) 0; }
.gb-carried .gb-mark { width: 12px; flex: none; color: var(--gb-faint); text-align: center; }
.gb-carried .gb-what { flex: 1; }
.gb-carried .gb-quest-item .gb-mark { color: var(--gb-accent); }
.gb-carried .gb-quest-item .gb-tag { border-color: var(--gb-accent-deep); color: var(--gb-accent); }

/* Codex: what has been found out, under one heading per kind of thing. A
   person carries how they stand towards the player and what has been learned
   of them, locked lines included, so there is always something to earn. */
.gb-codex-group { margin-bottom: var(--gb-s4); }
.gb-codex-group:last-child { margin-bottom: 0; }
.gb-codex-group h3 {
  padding-bottom: var(--gb-s1);
  margin-bottom: var(--gb-s2);
  border-bottom: 1px solid var(--gb-edge);
  color: var(--gb-accent);
}
.gb-codex-entry { padding: var(--gb-s2) 0; border-top: 1px solid rgba(242, 239, 230, 0.07); }
.gb-codex-entry:first-child { border-top: none; }
.gb-codex-entry h4 { margin: 0 0 2px; font-family: var(--gb-display); font-size: 14px; letter-spacing: 0.04em; color: var(--gb-ink); }
.gb-codex-entry p { color: var(--gb-dim); font-size: 13px; }
.gb-codex-head { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gb-s2); margin-bottom: 2px; }
.gb-codex-head h4 { margin: 0; }
.gb-codex-head .gb-known { margin-left: auto; color: var(--gb-faint); font-size: 11px; }
/* Five standings, three colours: against is warned, for is brass, neutral is quiet. */
.gb-disposition[data-disposition='hostile'], .gb-disposition[data-disposition='cool'] { border-color: var(--gb-warn); color: var(--gb-warn); }
.gb-disposition[data-disposition='warm'], .gb-disposition[data-disposition='friendly'] { border-color: var(--gb-accent-deep); color: var(--gb-accent); }
.gb-facts { margin-top: var(--gb-s1); }
.gb-facts li { display: flex; align-items: baseline; gap: var(--gb-s2); padding: 2px 0; font-size: 13px; color: var(--gb-dim); }
.gb-facts .gb-mark { width: 12px; flex: none; color: var(--gb-accent); text-align: center; }
.gb-facts .gb-fact-locked { color: var(--gb-faint); font-style: italic; }
.gb-facts .gb-fact-locked .gb-mark { color: var(--gb-faint); }

/* Settings: the clock, the sky, and the way out. */
.gb-setting { margin-bottom: var(--gb-s5); }
.gb-setting:last-child { margin-bottom: 0; }
.gb-setting h3 {
  padding-bottom: var(--gb-s1);
  margin-bottom: var(--gb-s3);
  border-bottom: 1px solid var(--gb-edge);
  color: var(--gb-accent);
}
.gb-setting-line { display: flex; align-items: center; gap: var(--gb-s3); }
.gb-settings .gb-clock { font-size: 26px; color: var(--gb-ink); }
.gb-weathers { display: flex; flex-wrap: wrap; gap: var(--gb-s2); }
.gb-settings button {
  padding: var(--gb-s2) var(--gb-s3);
  border: 1px solid var(--gb-edge);
  background: var(--gb-lift);
  color: var(--gb-ink);
  font-family: var(--gb-display);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color var(--gb-t) var(--gb-ease), color var(--gb-t) var(--gb-ease),
    background var(--gb-t) var(--gb-ease);
}
.gb-settings button:hover { border-color: var(--gb-accent); color: var(--gb-accent); }
.gb-settings button[aria-pressed='true'] { border-color: var(--gb-accent); background: var(--gb-accent); color: var(--gb-accent-ink); }
.gb-setting-exit { border-color: var(--gb-warn); }
.gb-setting-exit:hover { background: var(--gb-warn); color: var(--gb-ink); border-color: var(--gb-warn); }

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

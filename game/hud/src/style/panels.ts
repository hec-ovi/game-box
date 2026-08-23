/**
 * The three things that stay on screen while the player walks: what they are
 * meant to be doing, what they are carrying, and what the thing in front of
 * them would do. They frame the view from the corners and never cross it.
 */
export const PANELS = `
.gb-objectives, .gb-purse {
  position: absolute;
  top: var(--gb-s5);
  background: var(--gb-panel);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(10px) saturate(0.85);
  max-height: min(42vh, 340px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gb-accent-deep) transparent;
}

.gb-objectives {
  left: var(--gb-s5);
  width: min(330px, 32vw);
  border-left: 3px solid var(--gb-accent);
}
/* The head is the panel's label plate: it stays put while the steps scroll. */
.gb-objectives-head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: baseline;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s4);
  background: rgba(12, 14, 19, 0.96) var(--gb-hatch);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-objectives-head h2 { color: var(--gb-faint); }
.gb-objectives .gb-quest {
  flex: 1;
  min-width: 0;
  font-family: var(--gb-display);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--gb-accent);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gb-objectives ul { padding: var(--gb-s1) var(--gb-s4); }
.gb-objectives li {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: 0 var(--gb-s2);
  padding: var(--gb-s1) 0;
}
.gb-objectives li + li { border-top: 1px solid rgba(242, 239, 230, 0.07); }
.gb-objectives li[data-optional='true'] .gb-what { color: var(--gb-dim); }
.gb-objectives .gb-count {
  grid-row: 1;
  padding: 0 var(--gb-s1);
  border: 1px solid var(--gb-edge);
  background: var(--gb-well);
  color: var(--gb-accent);
  font-family: var(--gb-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}
.gb-objectives .gb-what { grid-column: 2; }
.gb-objectives li:not([data-counted]) .gb-what { grid-column: 1 / -1; }
.gb-objectives .gb-tag, .gb-objectives .gb-hint { grid-column: 1 / -1; justify-self: start; }
.gb-objectives .gb-tag { margin-top: 2px; }
/* An answerable step points at the tab that answers it, key and all. */
.gb-objectives .gb-decide {
  grid-column: 1 / -1;
  justify-self: start;
  display: flex;
  align-items: center;
  gap: var(--gb-s1);
  margin-top: 2px;
}
.gb-objectives .gb-hint { margin-top: 2px; font-size: 12px; color: rgba(233, 193, 120, 0.62); }
.gb-objectives .gb-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gb-s2);
  padding: var(--gb-s2) var(--gb-s4) var(--gb-s3);
  border-top: 1px solid var(--gb-edge);
  font-size: 12px;
  color: var(--gb-dim);
}

.gb-purse {
  right: var(--gb-s5);
  min-width: 132px;
  padding: var(--gb-s3) var(--gb-s4);
  border-right: 3px solid var(--gb-accent);
  text-align: right;
}
.gb-purse .gb-coin { display: block; font-weight: 400; }
.gb-purse .gb-num { font-size: 22px; letter-spacing: -0.01em; }
.gb-purse .gb-unit { margin-left: 5px; color: var(--gb-faint); }
.gb-purse ul { margin-top: var(--gb-s2); font-size: 13px; color: var(--gb-dim); }
.gb-purse li { padding: 1px 0; }
.gb-purse .gb-quest-item { color: var(--gb-accent); }

/* "E  Go into The Copper Wheel", low and central, where the eye already is. */
.gb-prompt {
  position: absolute;
  left: 50%;
  bottom: 124px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--gb-s3);
  padding: var(--gb-s2) var(--gb-s4);
  background: var(--gb-panel);
  border-top: 2px solid var(--gb-accent);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(10px) saturate(0.85);
  white-space: nowrap;
}
.gb-prompt[data-state='opening'], .gb-prompt[data-state='closing'] { transform: translateX(-50%) translateY(6px); }
.gb-prompt[data-state='open'] { transform: translateX(-50%) translateY(0); }
.gb-prompt kbd {
  min-width: 26px;
  padding: 3px 7px;
  border-color: var(--gb-accent-deep);
  color: var(--gb-accent);
  font-size: 12px;
}
`

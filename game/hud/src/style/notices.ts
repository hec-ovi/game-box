/**
 * What just happened. A finished quest lands as a brass slab across the top of
 * the view and stays long enough to read; picking up a bottle is a thin dark
 * line that is gone before it is in the way.
 */
export const NOTICES = `
.gb-notices {
  position: absolute;
  z-index: 5;
  left: 50%;
  top: 76px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  max-width: min(580px, calc(100vw - 48px));
}
.gb-notice {
  padding: 6px var(--gb-s3);
  background: var(--gb-panel);
  border-left: 2px solid var(--gb-edge-lit);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(10px);
  font-size: 13px;
  text-align: left;
  animation: gb-notice-in 160ms var(--gb-ease);
  transition: opacity 180ms var(--gb-ease), transform 180ms var(--gb-ease);
}
.gb-notice[data-tone='major'] {
  padding: var(--gb-s3) var(--gb-s5);
  border: none;
  border-top: 2px solid rgba(0, 0, 0, 0.35);
  border-bottom: 2px solid rgba(0, 0, 0, 0.35);
  background: var(--gb-accent) var(--gb-hatch);
  color: var(--gb-accent-ink);
  font-family: var(--gb-display);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
}
.gb-notice[data-tone='major'] .gb-detail {
  display: block;
  margin-top: 2px;
  font-family: var(--gb-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  opacity: 0.75;
}
.gb-notice[data-tone='minor'] .gb-detail { margin-left: var(--gb-s2); color: var(--gb-faint); }
.gb-notice.gb-quest-failed { background: var(--gb-warn) var(--gb-hatch); color: var(--gb-ink); }
.gb-notice.gb-step-done { border-left-color: var(--gb-accent); }
.gb-notice[data-sign='up'] { border-left-color: var(--gb-accent); color: var(--gb-accent); }
.gb-notice[data-sign='down'] { border-left-color: var(--gb-warn); color: var(--gb-warn); }
.gb-notice[data-sign] .gb-what { font-family: var(--gb-mono); font-variant-numeric: tabular-nums; }
.gb-notice[data-leaving='true'] { opacity: 0; transform: translateY(-6px); }
@keyframes gb-notice-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
`

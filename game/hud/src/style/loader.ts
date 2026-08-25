import { LAYERS } from './layout.ts'

/**
 * A city being written, or a ride between stations. It covers the view, so
 * nothing half-built shows under it, and lists the stages with the one under
 * way in brass; a veil has no stages and carries its title alone.
 */
export const LOADER = `
.gb-loader {
  position: absolute;
  inset: 0;
  z-index: ${LAYERS.loader};
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gb-solid) var(--gb-hatch);
  pointer-events: auto;
}
.gb-loader-card {
  position: relative;
  width: min(440px, calc(100% - 48px));
  padding: var(--gb-s5) var(--gb-s6);
  background: var(--gb-panel);
  box-shadow: var(--gb-frame);
}
.gb-loader-card h2 {
  margin-bottom: var(--gb-s4);
  padding-bottom: var(--gb-s2);
  border-bottom: 1px solid var(--gb-edge);
  color: var(--gb-accent);
  font-size: 14px;
}
.gb-loader[data-veil='true'] .gb-loader-card h2 { margin: 0; padding: 0; border: none; text-align: center; }
.gb-stages { display: flex; flex-direction: column; gap: var(--gb-s3); }
.gb-stage-line { display: flex; justify-content: space-between; gap: var(--gb-s3); margin-bottom: var(--gb-s1); }
.gb-stage[data-state='waiting'] { color: var(--gb-faint); }
.gb-stage[data-state='running'] { color: var(--gb-ink); }
.gb-stage[data-state='running'] .gb-what { color: var(--gb-accent); }
.gb-stage[data-state='done'] { color: var(--gb-dim); }
.gb-stage[data-state='done'] .gb-what::after { content: '\\00a0\\2713'; color: var(--gb-accent); }
.gb-stage .gb-num { font-size: 12px; color: var(--gb-dim); }
`

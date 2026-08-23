/**
 * The window itself: the scrim under it, the shell, and the tab strip that acts
 * as its title. Whichever tab is lit is what the player is reading, so the
 * window never says the same word twice.
 */
export const WINDOW = `
.gb-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 90% at 50% 45%, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.82));
  pointer-events: auto;
  z-index: 3;
}

.gb-window {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(620px, calc(100vw - 48px));
  min-height: 300px;
  max-height: min(74vh, 640px);
  display: flex;
  flex-direction: column;
  background: var(--gb-solid);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(16px) saturate(0.85);
  pointer-events: auto;
  z-index: 4;
}
.gb-window:focus { outline: none; }
.gb-window[data-state='opening'], .gb-window[data-state='closing'] {
  transform: translate(-50%, -50%) scale(0.985) translateY(6px);
}
.gb-window[data-state='open'] { transform: translate(-50%, -50%) scale(1) translateY(0); }
.gb-window-head {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: var(--gb-s3);
  padding: 0 var(--gb-s3) 0 0;
  background: rgba(0, 0, 0, 0.35) var(--gb-hatch);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-window-head .gb-close { align-self: center; }
.gb-window-body {
  flex: 1;
  min-height: 0;
  padding: var(--gb-s4) var(--gb-s5);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gb-accent-deep) transparent;
  animation: gb-face-in 110ms var(--gb-ease);
}
@keyframes gb-face-in {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

.gb-tabs { display: flex; }
.gb-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--gb-s3) var(--gb-s4);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gb-faint);
  font: inherit;
  cursor: pointer;
  transition: color var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease),
    border-color var(--gb-t) var(--gb-ease);
}
.gb-tab:hover { color: var(--gb-ink); background: rgba(242, 239, 230, 0.05); }
.gb-tab[aria-selected='true'] {
  color: var(--gb-accent);
  border-bottom-color: var(--gb-accent);
  background: rgba(233, 193, 120, 0.08);
}
.gb-tab[aria-selected='true'] kbd { border-color: var(--gb-accent-deep); color: var(--gb-accent); }
`

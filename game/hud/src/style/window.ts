import { INNER_LEFT, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * The window itself: the scrim under it, the room it is centred in, the frame
 * of one fixed size, and the tab strip that acts as its title. Whichever tab
 * is lit is what the player is reading, so the window never says the same
 * word twice, and whichever face is up the frame is the same shape.
 */
export const WINDOW = `
.gb-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 90% at 50% 45%, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.82));
  pointer-events: auto;
  z-index: ${LAYERS.scrim};
}

/* The room: the screen minus the corner, the notices band, the foot and, while
   a conversation is up, the side. The frame is centred in it. */
.gb-window-room {
  position: absolute;
  left: ${INNER_LEFT}px;
  right: ${LAYOUT.margin}px;
  top: ${LAYOUT.top}px;
  bottom: ${LAYOUT.foot}px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: ${LAYERS.window};
}
.gb-hud[data-talk='true'] .gb-window-room { right: ${SIDE_RIGHT}px; }

.gb-window {
  position: relative;
  width: ${LAYOUT.window.width}px;
  height: ${LAYOUT.window.height}px;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--gb-solid);
  box-shadow: var(--gb-frame);
  backdrop-filter: blur(16px) saturate(0.85);
  pointer-events: auto;
}
.gb-window:focus { outline: none; }
.gb-window[data-state='opening'], .gb-window[data-state='closing'] { transform: scale(0.985) translateY(6px); }
.gb-window[data-state='open'] { transform: scale(1) translateY(0); }
.gb-window-head {
  flex: none;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: var(--gb-s3);
  padding: 0 var(--gb-s3) 0 0;
  background: rgba(0, 0, 0, 0.35) var(--gb-hatch);
  border-bottom: 1px solid var(--gb-edge);
}
.gb-window-head .gb-close { align-self: center; }
/* The body is the one thing that scrolls: the frame never grows to a face. */
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

.gb-tabs { display: flex; flex-wrap: wrap; }
.gb-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--gb-s3) var(--gb-s3);
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

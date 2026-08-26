import { INNER_LEFT, LAYERS, LAYOUT, SIDE_RIGHT } from './layout.ts'

/**
 * The window: the scrim under it, the room it is centred in, the frame of one
 * fixed size, its title head and the tab strip beneath it. Whichever tab is
 * lit is what the player is reading, and whichever face is up the frame is the
 * same shape.
 */
export const WINDOW = `
.gb-hud .gb-scrim {
  position: absolute;
  inset: 0;
  z-index: ${LAYERS.scrim};
  background: var(--gb-scrim);
  pointer-events: auto;
}

/* The room: full view edge to edge */
.gb-hud .gb-window-room {
  position: absolute;
  left: 0px;
  top: 0px;
  right: 0px;
  bottom: 0px;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  pointer-events: none;
  z-index: ${LAYERS.window};
}
.gb-hud[data-talk='true'] .gb-window-room { right: 0; }

.gb-hud .gb-window {
  width: 100vw;
  height: 100vh;
  max-width: 100%;
  max-height: 100%;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  border: none;
}

/* The tab strip under the title: an icon, the word, the key. */
.gb-hud .gb-tabs {
  position: relative;
  flex: none;
  display: flex;
  flex-wrap: wrap;
  background: var(--gb-solid);
  box-shadow: inset 0 -1px 0 var(--gb-edge);
}
.gb-hud .gb-tab {
  --cut: var(--gb-cut-row);
  display: flex;
  align-items: center;
  gap: var(--gb-s2);
  height: 44px;
  padding: 0 var(--gb-s4);
  border: none;
  background: transparent;
  color: var(--gb-dim);
  cursor: pointer;
  pointer-events: auto;
  transition: color var(--gb-t-press) var(--gb-in), background-color var(--gb-t-press) var(--gb-in);
}
.gb-hud .gb-tab:hover { background: var(--gb-lift); color: var(--gb-ink); }
.gb-hud .gb-tab[aria-selected='true'] { background: var(--gb-lift); color: var(--gb-ink); }
.gb-hud .gb-tab[aria-selected='true'] kbd { --gb-line: var(--gb-accent); color: var(--gb-accent); }
.gb-hud .gb-tab:focus-visible { background: var(--gb-lift); color: var(--gb-accent-lit); }

/* The body is the one thing that scrolls: the frame never grows to a face. */
.gb-hud .gb-window-body {
  flex: 1;
  min-height: 0;
  padding: var(--gb-s4) var(--gb-s5);
}
/* The frame is nearly the width of the view, so the faces that are lists of
   rows run in columns a line of prose wide rather than one column the width of
   the screen. Under two columns' worth of room they fall back to one, which is
   what a small screen gets. An entry is never split down the middle.

   The quests face is not one of them: a page is a row with its steps under it,
   and that wants the width. */
.gb-hud .gb-inventory, .gb-hud .gb-codex, .gb-hud .gb-settings, .gb-hud .gb-controls {
  columns: 440px;
  column-gap: var(--gb-s6);
}
.gb-hud .gb-inventory .gb-coin { column-span: all; }
`

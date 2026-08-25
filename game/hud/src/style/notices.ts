import { INNER_LEFT, LAYERS, LAYOUT, NOTICES_TOP, SIDE_RIGHT } from './layout.ts'

/**
 * What just happened, in a column under the compass. A finished quest lands
 * large and stays long enough to read; picking up a bottle is a quiet line
 * that is gone before it is in the way. Each notice carries a key line in the
 * colour of its mood, so a fault and a wait never read as one thing.
 */
export const NOTICES = `
.gb-hud .gb-notices {
  position: absolute;
  z-index: ${LAYERS.notices};
  left: ${INNER_LEFT}px;
  right: ${LAYOUT.margin}px;
  top: ${NOTICES_TOP}px;
  max-height: ${LAYOUT.top - NOTICES_TOP}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.gb-hud[data-talk='true'] .gb-notices { right: ${SIDE_RIGHT}px; }
.gb-hud .gb-notice {
  --cut: var(--gb-cut-panel);
  --mood: var(--gb-accent);
  max-width: 580px;
  padding: 7px var(--gb-s3) 7px var(--gb-s4);
  box-shadow: inset 2px 0 0 var(--mood);
  filter: var(--gb-frame);
  color: var(--gb-ink);
}
.gb-hud .gb-notice[data-tone='major'] { padding: var(--gb-s3) var(--gb-s5) var(--gb-s3) var(--gb-s5); }
.gb-hud .gb-notice[data-tone='major']::before { background-image: var(--gb-hatch); }
.gb-hud .gb-notice[data-tone='major'] .gb-what { color: var(--gb-ink); }
.gb-hud .gb-notice[data-tone='major'] .gb-detail {
  display: block;
  margin-top: 3px;
  color: var(--gb-dim);
}
.gb-hud .gb-notice[data-tone='minor'] .gb-detail { margin-left: var(--gb-s2); color: var(--gb-faint); }

/* The mood, in one colour, on the key line and on what it is about. */
.gb-hud .gb-notice.gb-quest-complete { --mood: var(--gb-good); }
.gb-hud .gb-notice.gb-quest-failed, .gb-hud .gb-notice[data-mood='fault'] { --mood: var(--gb-danger); }
.gb-hud .gb-notice[data-mood='fault'] .gb-what { color: var(--gb-danger); }
.gb-hud .gb-notice[data-mood='wait'] { --mood: var(--gb-edge-lit); }
.gb-hud .gb-notice[data-mood='wait'] .gb-what { color: var(--gb-dim); }
.gb-hud .gb-notice[data-mood='wait'] .gb-num { color: var(--gb-accent); }
.gb-hud .gb-notice[data-sign='up'] { --mood: var(--gb-good); }
.gb-hud .gb-notice[data-sign='up'] .gb-what { color: var(--gb-good); }
.gb-hud .gb-notice[data-sign='down'] { --mood: var(--gb-danger); }
.gb-hud .gb-notice[data-sign='down'] .gb-what { color: var(--gb-danger); }
.gb-hud .gb-notice[data-sign] .gb-what { font-family: var(--gb-mono); font-variant-numeric: tabular-nums; }
`

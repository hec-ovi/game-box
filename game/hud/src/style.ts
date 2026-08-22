/**
 * The whole look of the interface. It ships as a string because the box has one
 * public entry, so an app that bundles it cannot import a second css file.
 * Square corners everywhere: no border-radius belongs in here.
 */
export const HUD_CSS = `
.gb-hud {
  --gb-ink: #f4f1ea;
  --gb-dim: rgba(244, 241, 234, 0.62);
  --gb-panel: rgba(13, 13, 15, 0.88);
  --gb-soft: rgba(13, 13, 15, 0.62);
  --gb-edge: rgba(244, 241, 234, 0.2);
  --gb-accent: #e8c07a;
  --gb-bad: #d0563a;
  --gb-lift: 0 0 0 1px rgba(0, 0, 0, 0.55), 0 6px 22px rgba(0, 0, 0, 0.4);
  --gb-t: 150ms;
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: var(--gb-ink);
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif;
  z-index: 10;
}
.gb-hud * { box-sizing: border-box; }
.gb-hud [hidden] { display: none !important; }
.gb-hud h2, .gb-hud h3 { margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
.gb-hud ul { margin: 0; padding: 0; list-style: none; }
.gb-hud .gb-empty { color: var(--gb-dim); }
.gb-hud kbd {
  display: inline-block;
  min-width: 22px;
  padding: 1px 5px;
  border: 1px solid var(--gb-edge);
  background: rgba(0, 0, 0, 0.4);
  color: var(--gb-ink);
  font: 600 11px/1.5 inherit;
  letter-spacing: 0.06em;
  text-align: center;
}

/* Opening and closing are transitions. A closing panel takes no clicks, so it
   is never in the way of what the player does next. */
.gb-hud [data-state] { transition: opacity var(--gb-t) ease, transform var(--gb-t) ease; }
.gb-hud [data-state='opening'], .gb-hud [data-state='closing'] { opacity: 0; }
.gb-hud [data-state='open'] { opacity: 1; }
.gb-hud [data-state='closing'] { pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .gb-hud [data-state], .gb-hud .gb-notice, .gb-hud .gb-crosshair { transition: none; animation: none; }
}

.gb-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 5px;
  margin: -2px 0 0 -2px;
  background: var(--gb-ink);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
  opacity: 0.6;
  transition: opacity var(--gb-t) ease;
}
.gb-hud[data-modal='true'] .gb-crosshair { opacity: 0; }

.gb-objectives {
  position: absolute;
  top: 18px;
  left: 18px;
  max-width: 340px;
  padding: 12px 14px;
  background: var(--gb-panel);
  border-left: 2px solid var(--gb-accent);
  box-shadow: var(--gb-lift);
  backdrop-filter: blur(8px) saturate(0.9);
}
.gb-objectives h2 { margin-bottom: 6px; color: var(--gb-dim); }
.gb-objectives li { padding: 2px 0; }
.gb-objectives .gb-quest { display: block; font-size: 12px; color: var(--gb-dim); }
.gb-objectives .gb-hint { display: block; font-size: 12px; color: var(--gb-accent); }

.gb-purse {
  position: absolute;
  top: 18px;
  right: 18px;
  min-width: 120px;
  padding: 12px 14px;
  background: var(--gb-panel);
  box-shadow: var(--gb-lift);
  backdrop-filter: blur(8px) saturate(0.9);
  text-align: right;
}
.gb-purse ul { margin-top: 6px; font-size: 13px; color: var(--gb-dim); }
.gb-purse .gb-quest-item { color: var(--gb-accent); }

.gb-prompt {
  position: absolute;
  left: 50%;
  bottom: 120px;
  transform: translateX(-50%);
  padding: 8px 14px;
  background: var(--gb-panel);
  border: 1px solid var(--gb-edge);
  box-shadow: var(--gb-lift);
  white-space: nowrap;
}
.gb-prompt[data-state='opening'], .gb-prompt[data-state='closing'] { transform: translateX(-50%) translateY(4px); }
.gb-prompt[data-state='open'] { transform: translateX(-50%) translateY(0); }
.gb-prompt kbd { margin-right: 10px; }

/* Announcements: what happened, loud or quiet depending on what it was. */
.gb-notices {
  position: absolute;
  z-index: 5;
  left: 50%;
  top: 22px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  max-width: min(560px, calc(100vw - 48px));
}
.gb-notice {
  padding: 7px 12px;
  background: var(--gb-soft);
  border: 1px solid var(--gb-edge);
  box-shadow: var(--gb-lift);
  backdrop-filter: blur(8px);
  color: var(--gb-ink);
  font-size: 13px;
  text-align: center;
  animation: gb-notice-in 160ms ease;
  transition: opacity 180ms ease, transform 180ms ease;
}
.gb-notice[data-tone='major'] {
  padding: 12px 22px;
  border: none;
  background: var(--gb-accent);
  color: #14100a;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.gb-notice[data-tone='major'] .gb-detail { display: block; margin-top: 2px; font-size: 13px; font-weight: 600; opacity: 0.8; }
.gb-notice[data-tone='minor'] .gb-detail { margin-left: 10px; color: var(--gb-dim); }
.gb-notice.gb-quest-failed { background: var(--gb-bad); color: var(--gb-ink); }
.gb-notice[data-leaving='true'] { opacity: 0; transform: translateY(-6px); }
@keyframes gb-notice-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* The way in to the windows, with the key printed on every button. */
.gb-bar {
  position: absolute;
  z-index: 4;
  left: 18px;
  bottom: 18px;
  display: flex;
  gap: 8px;
}
.gb-bar-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--gb-edge);
  background: var(--gb-panel);
  box-shadow: var(--gb-lift);
  color: var(--gb-ink);
  font: inherit;
  font-size: 13px;
  pointer-events: auto;
  cursor: pointer;
  transition: background var(--gb-t) ease, border-color var(--gb-t) ease;
}
.gb-bar-button:hover { border-color: var(--gb-accent); }
.gb-bar-button:focus-visible { outline: 2px solid var(--gb-accent); outline-offset: 1px; }
.gb-bar-button[aria-expanded='true'] { background: var(--gb-accent); color: #14100a; }
.gb-bar-button[aria-expanded='true'] kbd { border-color: rgba(0, 0, 0, 0.35); background: rgba(0, 0, 0, 0.12); color: #14100a; }
.gb-bar[data-keys-off='true'] kbd { opacity: 0.3; }

/* A close button that says what it does and which key does it too. */
.gb-close {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid var(--gb-edge);
  background: transparent;
  color: var(--gb-ink);
  font: inherit;
  font-size: 12px;
  pointer-events: auto;
  cursor: pointer;
  transition: background var(--gb-t) ease, border-color var(--gb-t) ease;
}
.gb-close:hover { border-color: var(--gb-accent); background: rgba(232, 192, 122, 0.12); }
.gb-close:focus-visible { outline: 2px solid var(--gb-accent); outline-offset: 1px; }

/* "Enter sends, Escape walks away", under the box it applies to. */
.gb-hints { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
.gb-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--gb-dim); }
.gb-keys { display: flex; gap: 4px; }

.gb-talk {
  position: absolute;
  left: 50%;
  bottom: 76px;
  transform: translateX(-50%);
  width: min(720px, calc(100vw - 48px));
  padding: 14px 16px;
  background: var(--gb-panel);
  border: 1px solid var(--gb-edge);
  box-shadow: var(--gb-lift);
  backdrop-filter: blur(8px) saturate(0.9);
  pointer-events: auto;
  z-index: 2;
}
.gb-talk[data-state='opening'], .gb-talk[data-state='closing'] { transform: translateX(-50%) translateY(10px); }
.gb-talk[data-state='open'] { transform: translateX(-50%) translateY(0); }
.gb-talk-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.gb-talk-head h3 { color: var(--gb-accent); font-size: 13px; }
.gb-talk .gb-reply { min-height: 3em; margin: 0 0 10px; white-space: pre-wrap; }
.gb-talk .gb-acted { margin: 0 0 10px; font-size: 12px; color: var(--gb-dim); }
.gb-talk .gb-say {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--gb-edge);
  background: rgba(0, 0, 0, 0.4);
  color: var(--gb-ink);
  font: inherit;
}
.gb-talk .gb-say:focus { outline: 2px solid var(--gb-accent); outline-offset: -1px; }

/* A window dims the scene behind it, and clicking that dim closes it. */
.gb-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  z-index: 3;
}

.gb-window {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(520px, calc(100vw - 48px));
  max-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  background: var(--gb-panel);
  border: 1px solid var(--gb-edge);
  box-shadow: var(--gb-lift);
  backdrop-filter: blur(10px) saturate(0.9);
  pointer-events: auto;
  z-index: 4;
}
.gb-window:focus { outline: none; }
.gb-window[data-state='opening'], .gb-window[data-state='closing'] { transform: translate(-50%, -50%) scale(0.98); }
.gb-window[data-state='open'] { transform: translate(-50%, -50%) scale(1); }
.gb-window-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--gb-edge);
}
.gb-window-head h2 { color: var(--gb-accent); }
.gb-window-body { overflow-y: auto; }

.gb-journal-quest { margin-bottom: 14px; }
.gb-journal-quest h3 { margin-bottom: 4px; text-transform: none; letter-spacing: 0; font-size: 14px; }
.gb-journal-quest li { display: flex; gap: 8px; padding: 1px 0; }
.gb-journal-quest .gb-step-done { color: var(--gb-dim); text-decoration: line-through; }
.gb-journal-quest .gb-mark { width: 12px; color: var(--gb-accent); }

.gb-control-group { margin-bottom: 14px; }
.gb-control-group h3 { margin-bottom: 6px; color: var(--gb-dim); }
.gb-control-group .gb-hints { flex-direction: column; gap: 6px; margin-top: 0; }
.gb-control-group .gb-hint { font-size: 13px; color: var(--gb-ink); }
.gb-control-group .gb-keys { min-width: 84px; }
`

const STYLE_ID = 'gb-hud-style'

/** Puts the stylesheet in the document once, whatever number of huds ask. */
export function installStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = HUD_CSS
  doc.head.append(style)
}

/**
 * The whole look of the interface. It ships as a string because the box has one
 * public entry, so an app that bundles it cannot import a second css file.
 * Square corners everywhere: no border-radius belongs in here.
 */
export const HUD_CSS = `
.gb-hud {
  --gb-ink: #f2efe8;
  --gb-panel: rgba(18, 18, 20, 0.82);
  --gb-edge: rgba(242, 239, 232, 0.22);
  --gb-accent: #e8c07a;
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: var(--gb-ink);
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif;
  z-index: 10;
}
.gb-hud * { box-sizing: border-box; }
.gb-hud [hidden] { display: none; }
.gb-hud h2, .gb-hud h3 { margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
.gb-hud ul { margin: 0; padding: 0; list-style: none; }
.gb-hud .gb-empty { opacity: 0.6; }

.gb-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 5px;
  margin: -2px 0 0 -2px;
  background: var(--gb-ink);
  opacity: 0.55;
}

.gb-objectives {
  position: absolute;
  top: 18px;
  left: 18px;
  max-width: 340px;
  padding: 12px 14px;
  background: var(--gb-panel);
  border-left: 2px solid var(--gb-accent);
}
.gb-objectives h2 { margin-bottom: 6px; opacity: 0.65; }
.gb-objectives li { padding: 2px 0; }
.gb-objectives .gb-quest { display: block; font-size: 12px; opacity: 0.55; }
.gb-objectives .gb-hint { display: block; font-size: 12px; color: var(--gb-accent); opacity: 0.75; }

.gb-purse {
  position: absolute;
  top: 18px;
  right: 18px;
  min-width: 120px;
  padding: 12px 14px;
  background: var(--gb-panel);
  text-align: right;
}
.gb-purse ul { margin-top: 6px; font-size: 13px; opacity: 0.8; }
.gb-purse .gb-quest-item { color: var(--gb-accent); opacity: 1; }

.gb-prompt {
  position: absolute;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  padding: 8px 14px;
  background: var(--gb-panel);
  border: 1px solid var(--gb-edge);
  white-space: nowrap;
}
.gb-prompt kbd {
  display: inline-block;
  min-width: 20px;
  margin-right: 8px;
  padding: 1px 5px;
  border: 1px solid var(--gb-edge);
  font: inherit;
  text-align: center;
}

.gb-notices {
  position: absolute;
  left: 50%;
  bottom: 150px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.gb-notice {
  padding: 8px 14px;
  background: var(--gb-accent);
  color: #14100a;
  font-weight: 600;
  white-space: nowrap;
}
.gb-notice .gb-detail { margin-left: 10px; opacity: 0.75; font-weight: 500; }
.gb-notice.gb-quest-failed { background: #b4462f; color: var(--gb-ink); }

.gb-talk {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  width: min(720px, calc(100vw - 48px));
  padding: 14px 16px;
  background: var(--gb-panel);
  border: 1px solid var(--gb-edge);
  pointer-events: auto;
}
.gb-talk h3 { margin-bottom: 6px; color: var(--gb-accent); }
.gb-talk .gb-reply { min-height: 3em; margin: 0 0 10px; white-space: pre-wrap; }
.gb-talk .gb-acted { margin: 0 0 10px; font-size: 12px; opacity: 0.7; }
.gb-talk .gb-say {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--gb-edge);
  background: rgba(0, 0, 0, 0.35);
  color: var(--gb-ink);
  font: inherit;
}
.gb-talk .gb-say:focus { outline: 1px solid var(--gb-accent); }

.gb-journal { position: absolute; left: 18px; bottom: 18px; }
.gb-journal button {
  padding: 6px 12px;
  border: 1px solid var(--gb-edge);
  background: var(--gb-panel);
  color: var(--gb-ink);
  font: inherit;
  pointer-events: auto;
  cursor: pointer;
}
.gb-journal button:focus-visible { outline: 1px solid var(--gb-accent); }
.gb-journal-panel {
  position: absolute;
  left: 0;
  bottom: 40px;
  width: min(420px, calc(100vw - 48px));
  max-height: 60vh;
  overflow-y: auto;
  padding: 14px 16px;
  background: var(--gb-panel);
  border: 1px solid var(--gb-edge);
  pointer-events: auto;
}
.gb-journal-panel h2 { margin-bottom: 10px; color: var(--gb-accent); }
.gb-journal-quest { margin-bottom: 12px; }
.gb-journal-quest h3 { margin-bottom: 4px; text-transform: none; letter-spacing: 0; font-size: 14px; }
.gb-journal-quest li { display: flex; gap: 8px; padding: 1px 0; }
.gb-journal-quest .gb-step-done { opacity: 0.5; text-decoration: line-through; }
.gb-journal-quest .gb-mark { width: 12px; color: var(--gb-accent); }
.gb-journal-close { margin-top: 4px; }
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

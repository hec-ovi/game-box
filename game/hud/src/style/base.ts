/**
 * What every surface shares: the frame, the type scale, the key caps, the
 * reticle and the two transitions. Square corners are a rule of the box, so no
 * border-radius belongs in any of these files.
 */
export const BASE = `
.gb-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: var(--gb-ink);
  font: 14px/1.5 var(--gb-body);
  z-index: 10;
  -webkit-font-smoothing: antialiased;
}
.gb-hud * { box-sizing: border-box; }
.gb-hud [hidden] { display: none !important; }
.gb-hud ul, .gb-hud ol { margin: 0; padding: 0; list-style: none; }
.gb-hud p { margin: 0; }

/* Anything that names a thing is stencilled: condensed, spaced, upper case. */
.gb-hud h2, .gb-hud h3, .gb-hud .gb-label, .gb-hud .gb-tag, .gb-hud .gb-unit {
  margin: 0;
  font-family: var(--gb-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.gb-hud .gb-empty { color: var(--gb-dim); }
.gb-hud .gb-num { font-family: var(--gb-mono); font-variant-numeric: tabular-nums; }

/* A tag says what a thing is without spending a colour on it. */
.gb-hud .gb-tag {
  padding: 1px 5px;
  border: 1px solid var(--gb-edge);
  color: var(--gb-dim);
  font-size: 9px;
  letter-spacing: 0.14em;
}

.gb-hud kbd {
  display: inline-block;
  min-width: 20px;
  padding: 1px 5px;
  border: 1px solid var(--gb-edge);
  border-bottom-width: 2px;
  background: var(--gb-well);
  color: var(--gb-dim);
  font-family: var(--gb-mono);
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}

/* Brass corners: the one ornament, and the thing that says this is an
   instrument rather than a document. */
.gb-hud .gb-bracket::before, .gb-hud .gb-bracket::after {
  content: '';
  position: absolute;
  width: 11px;
  height: 11px;
  pointer-events: none;
}
.gb-hud .gb-bracket::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--gb-accent);
  border-left: 2px solid var(--gb-accent);
}
.gb-hud .gb-bracket::after {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--gb-accent);
  border-bottom: 2px solid var(--gb-accent);
}

/* Opening and closing are transitions. A closing panel takes no clicks, so it
   is never in the way of what the player does next. */
.gb-hud [data-state] { transition: opacity var(--gb-t) var(--gb-ease), transform var(--gb-t) var(--gb-ease); }
.gb-hud [data-state='opening'], .gb-hud [data-state='closing'] { opacity: 0; }
.gb-hud [data-state='open'] { opacity: 1; }
.gb-hud [data-state='closing'] { pointer-events: none; }

/* A number that just moved says so once, in the direction it moved. */
.gb-hud [data-flash='up'] { animation: gb-flash-up 520ms var(--gb-ease); }
.gb-hud [data-flash='down'] { animation: gb-flash-down 520ms var(--gb-ease); }
@keyframes gb-flash-up {
  0% { color: var(--gb-accent); text-shadow: 0 0 12px rgba(233, 193, 120, 0.7); }
  100% { color: inherit; text-shadow: none; }
}
@keyframes gb-flash-down {
  0% { color: var(--gb-warn); }
  100% { color: inherit; }
}

@media (prefers-reduced-motion: reduce) {
  .gb-hud [data-state], .gb-hud .gb-notice, .gb-hud .gb-crosshair, .gb-hud [data-flash] {
    transition: none;
    animation: none;
  }
}

/* The reticle: a pip and four ticks with air between them, which open out and
   go brass the moment something is close enough to act on. */
.gb-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 3px;
  margin: -1.5px 0 0 -1.5px;
  background: var(--gb-ink);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.7);
  opacity: 0.75;
  transition: opacity var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease);
}
.gb-crosshair::before, .gb-crosshair::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.8));
  transition: width var(--gb-t) var(--gb-ease), height var(--gb-t) var(--gb-ease),
    margin var(--gb-t) var(--gb-ease), background var(--gb-t) var(--gb-ease);
}
.gb-crosshair::before {
  width: 1px;
  height: 16px;
  margin: -8px 0 0 1px;
  background: linear-gradient(to bottom, var(--gb-ink) 0 5px, transparent 5px 11px, var(--gb-ink) 11px 16px);
}
.gb-crosshair::after {
  width: 16px;
  height: 1px;
  margin: 1px 0 0 -8px;
  background: linear-gradient(to right, var(--gb-ink) 0 5px, transparent 5px 11px, var(--gb-ink) 11px 16px);
}
.gb-hud[data-reach='true'] .gb-crosshair { opacity: 1; background: var(--gb-accent); }
.gb-hud[data-reach='true'] .gb-crosshair::before {
  height: 24px;
  margin-top: -12px;
  background: linear-gradient(to bottom, var(--gb-accent) 0 8px, transparent 8px 16px, var(--gb-accent) 16px 24px);
}
.gb-hud[data-reach='true'] .gb-crosshair::after {
  width: 24px;
  margin-left: -12px;
  background: linear-gradient(to right, var(--gb-accent) 0 8px, transparent 8px 16px, var(--gb-accent) 16px 24px);
}
.gb-hud[data-modal='true'] .gb-crosshair { opacity: 0; }
`

/**
 * The whole look in one place: five colours, three type stacks, one spacing
 * step and one motion curve. Everything downstream reads these, so retuning the
 * interface is retuning this file.
 *
 * The palette is warm ink on lacquered black with brass for anything the player
 * can act on, three fills for the plan (a background plot, a notable one, a
 * landmark), and the green of a screen's glass for what a machine shows. It has to hold over a noon sky and a night street, so no panel
 * ever puts text straight on the scene: the panel carries the contrast, with a
 * black hairline outside it and a pale hairline inside.
 */
export const TOKENS = `
.gb-hud {
  --gb-ink: #f2efe6;
  --gb-dim: rgba(242, 239, 230, 0.64);
  --gb-faint: rgba(242, 239, 230, 0.4);
  --gb-panel: rgba(10, 12, 17, 0.9);
  --gb-solid: rgba(9, 11, 15, 0.96);
  --gb-lift: rgba(30, 35, 45, 0.9);
  --gb-well: rgba(0, 0, 0, 0.45);
  --gb-edge: rgba(242, 239, 230, 0.16);
  --gb-edge-lit: rgba(242, 239, 230, 0.38);
  --gb-accent: #e9c178;
  --gb-accent-deep: #9c6f30;
  --gb-accent-ink: #15110a;
  --gb-warn: #d8583a;

  --gb-glass: #07100a;
  --gb-phosphor: #9ee8a4;
  --gb-phosphor-dim: rgba(158, 232, 164, 0.45);

  --gb-plot: rgba(233, 214, 186, 0.3);
  --gb-plot-notable: rgba(233, 193, 120, 0.55);
  --gb-plot-landmark: rgba(233, 193, 120, 0.85);

  --gb-frame: 0 0 0 1px rgba(0, 0, 0, 0.72), inset 0 0 0 1px rgba(242, 239, 230, 0.07),
    0 12px 34px rgba(0, 0, 0, 0.5);
  --gb-hatch: repeating-linear-gradient(135deg, rgba(242, 239, 230, 0.05) 0 1px, transparent 1px 5px);

  --gb-display: 'Avenir Next Condensed', 'Roboto Condensed', 'Liberation Sans Narrow', 'Arial Narrow',
    ui-sans-serif, system-ui, sans-serif;
  --gb-body: ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif;
  --gb-mono: ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, monospace;

  --gb-s1: 4px;
  --gb-s2: 8px;
  --gb-s3: 12px;
  --gb-s4: 16px;
  --gb-s5: 22px;
  --gb-s6: 32px;

  --gb-t: 140ms;
  --gb-ease: cubic-bezier(0.2, 0.7, 0.3, 1);
}
`

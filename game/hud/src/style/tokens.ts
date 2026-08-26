import { MS } from '../motion.ts'

/**
 * The whole look in one place: the palette, the three type stacks, the spacing
 * step, the chamfer sizes and the motion vocabulary. Every other file in this
 * folder reads these, so a colour or a duration is changed here and the whole
 * interface follows. Nothing downstream writes a colour literal.
 *
 * The city is cyberpunk at night, so the ground is near black with a teal cast
 * and the accent is the city's cyan. Brass is the second accent and marks the
 * main line of quests against side work, one amber thing in a cyan field. The
 * street's magenta and its neon reds stay on the street, so a sign burning
 * behind the glass is never mistaken for a control.
 */
export const TOKENS = `
.gb-hud {
  /* Ground, three depths and the two extremes. */
  --gb-void: #05080a;
  --gb-panel: rgba(10, 17, 20, 0.88);
  --gb-solid: #0c1519;
  --gb-lift: #132025;
  --gb-well: #050b0e;
  --gb-scrim: rgba(4, 8, 10, 0.74);

  /* The conversation, which stands over the street rather than covering it. A
     blur would read better and is not allowed here: it makes the compositor
     read the frame back every frame, over a scene that is already drawing. So
     the density does the work instead, and it is a gradient rather than one
     value: sheerest at the inner edge where the city should show through,
     deepest under the column of text. */
  --gb-sheer: linear-gradient(to right, rgba(5, 11, 14, 0.34), rgba(5, 11, 14, 0.8));
  --gb-sheer-lift: rgba(21, 35, 41, 0.62);
  --gb-sheer-well: rgba(4, 9, 12, 0.55);

  /* Edges: at rest, under the pointer, and on the thing that is chosen. */
  --gb-edge: #1d3038;
  --gb-edge-lit: #2e555f;
  --gb-edge-accent: rgba(47, 217, 230, 0.55);

  /* The accent: anything the player can act on, anything read first. */
  --gb-accent: #2fd9e6;
  --gb-accent-lit: #7df3fa;
  --gb-accent-dim: #14707a;
  --gb-accent-ink: #04161a;
  --gb-accent-glow: rgba(47, 217, 230, 0.3);

  /* Brass: the main line of quests, and nothing else. */
  --gb-main: #e8b44a;
  --gb-main-lit: #ffd07a;
  --gb-main-dim: #6e5320;
  --gb-main-ink: #171004;

  /* Text, by rank. */
  --gb-ink: #dceef2;
  --gb-dim: #8ea8b0;
  --gb-faint: #576e76;

  /* States. */
  --gb-good: #35d48a;
  --gb-warn: #ff8a2b;
  --gb-danger: #ff4d5e;
  --gb-off: #33454b;
  --gb-off-ink: #5c7178;

  /* A machine's screen: its own world, green phosphor on black glass. */
  --gb-glass: #030a06;
  --gb-phosphor: #6bff9e;
  --gb-phosphor-dim: #1e6b3a;

  /* The plan: a plot nobody named, one worth noticing, a landmark. */
  --gb-plot: rgba(47, 217, 230, 0.1);
  --gb-plot-notable: rgba(47, 217, 230, 0.24);
  --gb-plot-landmark: rgba(47, 217, 230, 0.42);

  /* Composites. The drop is a filter because a chamfer clips a box shadow away. */
  --gb-frame: drop-shadow(0 18px 44px rgba(0, 0, 0, 0.6));
  --gb-hatch: repeating-linear-gradient(135deg, rgba(47, 217, 230, 0.06) 0 3px, transparent 3px 7px);

  /* Type: system stacks only, so the box ships as one string with no assets. */
  --gb-display: 'Archivo Narrow', 'Roboto Condensed', 'Liberation Sans Narrow', 'Arial Narrow', ui-sans-serif,
    system-ui, sans-serif;
  --gb-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --gb-mono: ui-monospace, 'JetBrains Mono', 'DejaVu Sans Mono', 'SF Mono', Menlo, Consolas, monospace;

  --gb-s1: 4px;
  --gb-s2: 8px;
  --gb-s3: 12px;
  --gb-s4: 16px;
  --gb-s5: 22px;
  --gb-s6: 32px;

  /* The chamfer, by what wears it. Corners are cut, never rounded. */
  --gb-cut-frame: 14px;
  --gb-cut-panel: 10px;
  --gb-cut-row: 6px;
  --gb-cut-chip: 4px;

  /* Motion: two curves and seven durations, and nothing else anywhere. */
  --gb-in: cubic-bezier(0.2, 0.7, 0.2, 1);
  --gb-out: cubic-bezier(0.5, 0, 0.9, 0.4);
  --gb-t-press: ${MS.press}ms;
  --gb-t-state: ${MS.state}ms;
  --gb-t-value: ${MS.value}ms;
  --gb-t-leave: ${MS.leave}ms;
  --gb-t-enter: ${MS.enter}ms;
  --gb-t-veil: ${MS.veil}ms;
  --gb-stagger: ${MS.stagger}ms;
}
`

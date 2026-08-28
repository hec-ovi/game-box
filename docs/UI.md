# The interface

One specification for every surface the player reads over the city: the hud
(`game/hud`) and the front door (`game/app`'s boot panel). Two people building
different surfaces from this file produce one interface.

The city is cyberpunk at night (`docs/LOOK.md`): cyan and teal dominant, near
black surfaces, everything bright wearing a halo. The interface belongs to that
city, so the ground is near black with a teal cast and the accent is the city's
cyan. It never uses the street's magenta or its neon reds, so a sign burning
behind the glass is never mistaken for a control.

The shapes and the rhythm are cut corners, thin
luminous edges, corner readouts, an icon on every row, chips, keyed options,
monospaced numbers. Their fiction, their logos, their currencies and their XP
badges stay there.

Two rules that override taste: no `border-radius` anywhere except the conversation's own box, send button, thinking orb and waiting dots, which he asked for round (corners are
chamfered with `clip-path`), and nothing animates except `transform` and
`opacity`, because this interface draws over a 3D scene running every frame.
No `backdrop-filter`, no animated `width`, `height`, `top`, `left`, `filter`,
`box-shadow` or `background`.

---

## 1. The palette

Declared as custom properties on the root of each surface. Nothing downstream
writes a colour of its own.

### Ground, three depths

| Token | Hex | For |
|---|---|---|
| `--gb-void` | `#05080A` | behind everything: the scrim's base, the loader, the landing screen |
| `--gb-panel` | `#0A1114` | a panel floating over the game, at `0.88` alpha: `rgba(10,17,20,0.88)` |
| `--gb-solid` | `#0C1519` | a frame that owns the view (the window, the counter, the confirm), opaque |
| `--gb-lift` | `#132025` | a raised thing: an icon tile, a row hovered, a key cap, a tab at rest |
| `--gb-well` | `#050B0E` | a sunken thing: a text field, a progress track, a selected row, the map ground |

### Edges

| Token | Hex | For |
|---|---|---|
| `--gb-edge` | `#1D3038` | every hairline at rest: frames, rows, tiles, rules |
| `--gb-edge-lit` | `#2E555F` | the hairline of a thing under the pointer or holding focus |
| `--gb-edge-accent` | `rgba(47,217,230,0.55)` | the hairline of a selected or active thing |

### The accent, cyan

Anything the player can act on, anything the interface wants read first.

| Token | Hex | For |
|---|---|---|
| `--gb-accent` | `#2FD9E6` | the accent at rest: a border, a key line, an active tab, a route |
| `--gb-accent-lit` | `#7DF3FA` | hover, focus, pressed, the value that just changed |
| `--gb-accent-dim` | `#14707A` | a quiet accent: an inactive rule, a track fill, a mark past the rim |
| `--gb-accent-ink` | `#04161A` | text and icons sitting on a filled accent |
| `--gb-accent-glow` | `rgba(47,217,230,0.30)` | the halo, as a static `box-shadow` only, never animated |

### The second accent, brass

Only the main line of quests, against side work. It marks, it tags and it fills
a bar; it is never a general purpose highlight. `map_zones.jpeg` is the pattern:
one thing in amber against a cyan field.

| Token | Hex | For |
|---|---|---|
| `--gb-main` | `#E8B44A` | the main line: its mark, its `Main` tag, its progress fill |
| `--gb-main-lit` | `#FFD07A` | the same under the pointer or holding focus |
| `--gb-main-dim` | `#6E5320` | its quiet edge and its track |
| `--gb-main-ink` | `#171004` | text sitting on filled brass |

### Text, by rank

| Token | Hex | For |
|---|---|---|
| `--gb-ink` | `#DCEEF2` | a title, a value, anything read first |
| `--gb-dim` | `#8EA8B0` | a supporting line, a label, an icon at rest |
| `--gb-faint` | `#576E76` | a done step, metadata, a tick mark, a hint |

### States

| Token | Hex | For |
|---|---|---|
| `--gb-good` | `#35D48A` | done, unlocked, paid, a stage finished |
| `--gb-warn` | `#FF8A2B` | attention without failure: a price out of reach, a timer under a tenth |
| `--gb-danger` | `#FF4D5E` | a failure: a quest failed, giving up, a wrong password, credits going out |
| `--gb-off` | `#33454B` | a disabled edge or fill |
| `--gb-off-ink` | `#5C7178` | text and icons on a disabled thing |

### The machine's screen

Its own world, untouched by the rest: green phosphor on black glass.

| Token | Hex | For |
|---|---|---|
| `--gb-glass` | `#030A06` | the glass |
| `--gb-phosphor` | `#6BFF9E` | the characters |
| `--gb-phosphor-dim` | `#1E6B3A` | the grid, the status line, the glow |

### Two composites

| Token | Value | For |
|---|---|---|
| `--gb-frame` | `0 18px 44px rgba(0,0,0,0.60)` | the drop every frame wears, static |
| `--gb-hatch` | `repeating-linear-gradient(135deg, rgba(47,217,230,0.06) 0 3px, transparent 3px 7px)` | the diagonal on a header or a major notice |
| `--gb-scrim` | `rgba(4,8,10,0.74)` | behind a frame that owns the view |

---

## 2. The type

System stacks only. No font file is downloaded or inlined.

```css
--gb-display: "Archivo Narrow", "Roboto Condensed", "Liberation Sans Narrow",
              "Arial Narrow", ui-sans-serif, system-ui, sans-serif;
--gb-body:    ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
              "Helvetica Neue", Arial, sans-serif;
--gb-mono:    ui-monospace, "JetBrains Mono", "DejaVu Sans Mono", "SF Mono",
              Menlo, Consolas, monospace;
```

Display carries labels, headers and tabs, always upper case and tracked. Body
carries prose, dialogue and descriptions, sentence case. Mono carries numbers.

**Every number is monospaced**, with `font-variant-numeric: tabular-nums`, at
the size of the text it sits in and weight 500: credits, prices, counts, the
clock, distances, bearings, scores, timers, percentages, keys on a key cap,
the numbers on conversation options. A count that changes must not shift what
is beside it.

| Step | Size / weight / tracking | Face | For |
|---|---|---|---|
| `t0` | 10 / 600 / `0.14em` upper | display | corner readouts, unit suffixes, key caps, tick labels |
| `t1` | 11 / 600 / `0.12em` upper | display | row eyebrows, tags, chips, buttons |
| `t2` | 12 / 400 / `0` | body | a row's supporting line, a hint, metadata |
| `t3` | 13 / 400 / `0` | body | prose, dialogue, a quest description |
| `t4` | 15 / 600 / `0.02em` | body | a row title, a setting's label |
| `t5` | 17 / 600 / `0.08em` upper | display | a panel header |
| `t6` | 22 / 600 / `0.06em` upper | display | a frame's title, a speaker's name |
| `t7` | 30 / 600 / `0.10em` upper | display | the landing screen and the loader |

Line height 1.45 on `t2` and `t3`, 1.2 everywhere else. A supporting line is
one line, clipped with an ellipsis. No text is centred except a frame title and
the loader.

---

## 3. The panel language

### The chamfer

Two opposite corners are cut, on the diagonal that faces the centre of the
view, so the cut always points at the play area.

```css
.gb-cut  { clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)),
                              calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)); }
.gb-cut-alt { clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut),
                              100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut))); }
```

| `--cut` | On |
|---|---|
| `14px` | a frame: the window, the counter, the confirm, the loader panel, a landing card |
| `10px` | a panel: objectives, minimap, compass strip, a notice, the conversation, a screen bezel |
| `6px` | a row, a button, a field, a tab |
| `4px` | a chip, a key cap, an icon tile, a progress track |

### The edge

A border cannot follow a `clip-path`, so an edge is two layers: the outer
element painted in the edge colour, the inner inset `1px` and painted in the
ground. Both carry the same clip with the inner one `1px` smaller.

```css
.gb-edged      { --cut: 10px; background: var(--gb-edge); }
.gb-edged > *  { --cut: 9px; margin: 1px; background: var(--gb-panel); }
```

Lit means the outer layer takes `--gb-edge-lit` or `--gb-edge-accent`. A frame
also carries `box-shadow: var(--gb-frame)`.

### Corner ticks

A frame wears an L of `1px` accent, `10px` on each arm, inside its two square
corners, at `0.7` opacity. From `map1.png`. Frames only, never rows.

### The header

`38px` tall, `t5` in `--gb-ink`, padded `14px`, `--gb-hatch` over `--gb-lift`.
Under it a `1px` rule in `--gb-edge` whose first `48px` is `--gb-accent`. The
right end holds the close button and its key cap. A frame's title uses `t6` and
sits in a `54px` header.

### Ground by depth

Floating over the game: `--gb-panel` at `0.88`. Owning the view: `--gb-solid`
opaque, over a `--gb-scrim`. Raised inside a panel: `--gb-lift`. Sunken:
`--gb-well`. Depths never nest more than two deep.

### Selected, disabled

Selected: ground `--gb-well`, edge `--gb-edge-accent`, a `2px` key line down
the left edge in `--gb-accent` (`--gb-main` when it is the main line), title to
`--gb-ink`, icon to `--gb-accent`.

Disabled: ground unchanged, edge `--gb-off`, text and icon `--gb-off-ink`, no
key line, no hover response, `cursor: default`, `aria-disabled`. A disabled
thing is readable, never hidden: a price out of reach stays on the counter with
its number in `--gb-warn`.

---

## 4. The row

The quest list, the inventory, the codex, the settings, the station list, the
counter, the bearings and the city grid are all this row. Specify it once, build
it once. From `gamequests.jpg`.

```
[ icon tile ][ title                    ][ state ][ action ][ key ]
[  36 x 36  ][ supporting line          ][  bar  ][ button ][ cap ]
```

- Height `58px` (`44px` in a compact list: settings, controls, bearings).
- Grid `36px 1fr auto auto`, gap `12px`, padding `0 12px`, `--cut: 6px`.
- Rows are separated by a `1px` `--gb-edge` rule, not by gaps.
- **Icon tile**: `36px` square, `--cut: 4px`, ground `--gb-lift`, edge
  `--gb-edge`, icon `20px` in `--gb-dim`. Selected: edge `--gb-edge-accent`,
  icon `--gb-accent`.
- **Title**: `t4` in `--gb-ink`. Done: `--gb-faint` with `line-through`.
- **Supporting line**: `t2` in `--gb-dim`, one line, ellipsis.
- **State**: either a progress bar (track `96 x 4`, `--gb-well` with a `1px`
  `--gb-edge`, fill in `--gb-accent`, or `--gb-main` on the main line) with its
  count in mono `t1` beside it, or a chip: `t1`, padding `3px 7px`, `--cut:
  4px`, ground `--gb-lift`, text in the state colour, edge in the same colour
  at `0.4`.
- **Action**: `28px` tall, `t1`, `--cut: 6px`. Lit (the one thing to do here):
  ground `--gb-accent`, text `--gb-accent-ink`. Quiet: ground `--gb-lift`, edge
  `--gb-edge`, text `--gb-ink`.
- **Key cap**: `18px` square, `--cut: 4px`, mono `t0`, `--gb-lift` with
  `--gb-edge`, text `--gb-dim`; `--gb-accent` text and edge while its key is
  armed. Every option the keyboard can reach carries one, at its right edge,
  the way `chatdialog.jpg` numbers its replies.
- **Left key line**: `2px` down the left edge, transparent at rest, then
  `--gb-accent` selected, `--gb-main` on the main line, `--gb-danger` failed,
  `--gb-off` disabled. This is the accent tab from `chatdialog.jpg`.

Hover: ground to `--gb-lift`, edge to `--gb-edge-lit`, `translateX(2px)` over
90 ms. A row with no action is not a button and does not respond to hover.

---

## 5. Iconography

An icon is inline SVG in the markup, `viewBox="0 0 24 24"`, `fill="none"`,
`stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="square"`,
`stroke-linejoin="miter"`. One colour, inherited. No icon fonts, no image
files, no two-tone icons, no filled icons except a mark on the map.

Boxes: `20px` in a row's tile, `16px` in a button or a chip, `18px` in a tab,
`14px` beside a line of text. An icon never sits alone where a word would do.

The set, named:

`quest-main` (crown), `quest-side` (compass), `map`, `inventory` (case),
`codex` (book), `settings` (gear), `controls` (keyboard), `leave` (arrow out
of a bracket), `close` (cross), `check`, `chevron-left`, `chevron-right`,
`chevron-up`, `chevron-down`, `plus`, `minus`, `fit` (frame corners), `you`
(arrow head), `pin` (destination), `diamond` (main goal), `ring` (side goal),
`station` (train), `door`, `home`, `credit` (chip), `item` (cube), `person`,
`clock`, `hourglass` (timer), `weather-clear`, `weather-rain`, `weather-fog`,
`minimap`, `fullscreen`, `lock`, `unlock`, `screen` (terminal), `counter`
(scales), `search`, `filter`, `warn` (triangle), `info`, `city` (skyline, for
a save with no image), `seed` (asterisk).

---

## 6. Motion

Motion says a thing arrived, changed or left. It never delays input: a click
runs its handler on the same tick and the motion follows.

### The easing family

```css
--gb-in:  cubic-bezier(0.20, 0.70, 0.20, 1.00);   /* arriving, changing */
--gb-out: cubic-bezier(0.50, 0.00, 0.90, 0.40);   /* leaving */
```

These two, nothing else, anywhere.

### Durations

```css
--gb-t-press:  90ms;   /* a press, a hover, the reticle opening */
--gb-t-state: 140ms;   /* selected, toggled, a tab underline sliding, a count bumping */
--gb-t-value: 200ms;   /* a bar filling, a number counting, a tab's content sliding */
--gb-t-leave: 200ms;   /* any surface leaving */
--gb-t-enter: 320ms;   /* any surface arriving */
--gb-t-veil:  400ms;   /* the loader and the landing screen, the only 400s */
--gb-stagger:  24ms;   /* per item, capped at 8 items */
```

Nothing over 240 ms for a state change. Nothing over 400 ms for a surface.

### What moves

| Kind | Enter | Leave |
|---|---|---|
| A frame (window, counter, confirm) | `translateY(12px)` and `opacity 0` to rest, `--gb-t-enter` | `translateY(6px)`, `opacity 0`, `--gb-t-leave` |
| The scrim behind it | `opacity` only, `--gb-t-value` | `opacity`, `--gb-t-leave` |
| A side panel (the conversation) | `translateX(24px)` and `opacity 0`, `--gb-t-enter` | the same way it came, `--gb-t-leave` |
| A corner panel (objectives, minimap, compass) | `translateY(-8px)` and `opacity 0`, `--gb-t-enter` | `--gb-t-leave` |
| A notice | `translateX(-24px)` and `opacity 0`, `--gb-t-enter` | out to the same edge, `--gb-t-leave` |
| A tab's content | in from `translateX(16px)` while the old goes to `translateX(-16px)`, both `--gb-t-value`; the signs flip when the player moves left along the strip | |
| A list of rows | each row `translateY(6px)` and `opacity 0`, `--gb-t-value`, delayed `index * --gb-stagger`, capped at 8 | none: a list leaves with its frame |
| A conversation turn | `translateY(6px)` and `opacity 0`, `--gb-t-value`; turns already on the transcript never move | |
| The loader and the landing screen | `opacity` only, `--gb-t-veil` | `opacity`, `--gb-t-veil` |

A panel rises and settles: it never scales, because a `1px` edge under a scale
goes soft.

### What a value does

- **A number that changes** counts to its new value over `--gb-t-value` on
  `requestAnimationFrame`, in mono with tabular figures, so nothing beside it
  moves. Under a 3 unit change it snaps.
- **A bar that fills** animates `transform: scaleX()` on an inner element with
  `transform-origin: left`, over `--gb-t-value`. Never `width`.
- **A count that climbs** (`2/5` to `3/5`) bumps: `scale(1.12)` to `1` over
  `--gb-t-state`, on the number's own inline-block, and the colour goes to
  `--gb-accent-lit` and back over the same time.
- **A toggle** slides its knob `translateX` over `--gb-t-state`; the label
  changes at once.
- **A tab underline** is one `2px` accent element under the strip, moved with
  `translateX` and `scaleX` over `--gb-t-state`.

### The rules that cannot bend

- `transform` and `opacity` only. Anything that lays out or repaints per frame
  is forbidden over a running scene.
- `will-change: transform, opacity` is set when a surface starts moving and
  removed when it stops. Panels carry `contain: paint`.
- A surface is closed the moment it is asked to close: it stops taking clicks,
  leaves the accessible tree and lets the keyboard go, and only its pixels
  linger for `--gb-t-leave`.
- Nothing loops. No pulse, no shimmer, no spinner that turns forever: the
  loader's bars move because a build reported progress.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .gb-hud, .gb-boot { --gb-t-press: 1ms; --gb-t-state: 1ms; --gb-t-value: 1ms;
                      --gb-t-leave: 1ms; --gb-t-enter: 1ms; --gb-t-veil: 1ms;
                      --gb-stagger: 0ms; }
}
```

Every transition collapses to an instant change, every stagger delay goes to
zero, counted numbers snap to their value, and bars set their `scaleX` without
a transition. Nothing is removed from the screen and nothing changes place.

---

## 7. Per surface

**The window and its tabs** (`gamequests.jpg`). One frame, `--cut: 14px`, a
`54px` title header with the face's name and the close button, then the tab
strip: six tabs, each an `18px` icon over `t1` upper with its key cap at the
right. The active tab takes `--gb-lift`, `--gb-ink` and the sliding accent
underline; the rest are `--gb-dim` on `--gb-solid`. The frame rises 12 px on
open; switching face slides the body sideways and staggers its rows.

**The quest list** (`gamequests.jpg`). Rows exactly as section 4: the kind icon
in the tile (`quest-main` crowned, `quest-side` a compass), the title, the
step under way as the supporting line, the step count as a bar with `2/5`
beside it, then Track or Give up. The main line sorts first with a `Main` chip
and a brass key line, bar and mark. A failed page carries a `Failed` chip in
`--gb-danger` and its reason on the supporting line; a done page carries
`Done` in `--gb-good` and no buttons. A timed page shows `hourglass` and its
remaining time in mono, going `--gb-warn` under a tenth.

**The map** (`map2.png`, `map_zones.jpeg`). Ground `--gb-well`, plots as flat
fills at three prominences, streets as `1px` `--gb-edge` hairlines. The route
to the tracked goal is a `2px` `--gb-accent` line with a ring node at each turn
and a `pin` at the end. The player is a filled `--gb-accent` arrow; the main
line's goal is a filled brass diamond, side work an open cyan ring. Stations
are ink squares with their names. The four tools sit over the plan as one
strip of key-capped buttons, and the bearings list under it is compact rows.
Zoom and pan are the map's own transform and are not animated; swinging onto a
picked bearing eases over `--gb-t-value`.

**The minimap** (`map2.png`, its corner readouts). A `230px` square panel,
`--cut: 10px`, `--gb-well` ground, a `1px` `--gb-edge` frame with accent corner
ticks, north up, the player's arrow at the centre. Goals wear the map's own
marks; one past the radius pins to the rim in `--gb-accent-dim`. A doorway
already walked through is an open ink square. It appears and leaves with the
corner panel motion and never animates its contents: the arrow's rotation is a
`transform` written on every push.

**The compass** (`map1.png`'s top rule). A `360 x 44` strip, `--cut: 10px`,
`--gb-panel`, showing 120 degrees of arc: tick marks in `--gb-faint`, the
cardinal letters in `t0`, the centre marked by a `1px` accent line. The goal's
mark rides at its bearing and pins to the nearer edge when it is behind. Under
the strip the goal's name in `t1` and its distance in mono. The points slide by
`translateX` only.

**The conversation** (`chatdialog.jpg`). A `380px` panel down the right, in on
`translateX(24px)`. The speaker's name plate sits over the transcript body:
`t6` on `--gb-lift` with `--gb-hatch` and an accent underline. Turns are
`t3`; the speaker's are `--gb-ink`, the player's are inset with an accent key
line, and a stage direction is `t2` in `--gb-faint` italic. Moves are bars
along the foot: a `2px` accent tab at the left edge, the words in `t3`, the
number in mono at the right. Each new turn enters on its own; a streamed reply
writes into the node already there and animates nothing. A quieted menu drops
to `0.5` opacity over `--gb-t-state` and takes no clicks.

**The counter** (`gamequests.jpg`'s currency plate). A `520 x 460` frame with
the seller's name in its header and the player's credits on a plate at the top
right: `credit` icon, mono `t4`, `--gb-lift`, accent edge. One row per offer
with `item` in the tile, the price in mono and a lit Buy. A price out of reach
is `--gb-warn` and its button disabled. After a sale the credits count down
over `--gb-t-value` and the sold row leaves with the push that removes it.

**The terminal screen** (`map1.png`'s monospace readouts). Untouched by the
palette above: `--gb-glass` ground, `--gb-phosphor` characters, a `1px`
`--gb-phosphor-dim` bezel with a chamfer at `10px`, one grid of 48 by 21
characters whatever runs on it. The title bar and close button use the
interface's own type so the machine reads as a thing in the world with the
interface around it. It fades in over `--gb-t-enter` with no movement, because
a screen the player sat down at does not fly.

**The notices** (`map2.png`'s corner readouts). A column under the compass,
each notice `--cut: 10px` on `--gb-panel` with a `2px` key line in its mood
colour: `--gb-good` finished, `--gb-main` a main quest moving, `--gb-danger` an
error, `--gb-accent` everything else. Major notices are `t5` with `--gb-hatch`
and stay 5200 ms; minor are `t2` and stay 2600 ms. They enter from the left
edge and leave the same way; the ones below slide up by `translateY` over
`--gb-t-value` as one goes.

**The objectives corner** (`map1.png`'s MISSION EVENT block). A `330px` panel,
`--cut: 10px` cut on the diagonal facing the middle of the view, a `t1` header
with the tracked quest's line icon and its `Main` chip when it is the story,
then the open steps: a `6px` accent diamond as the pointer on the step the
player is on, `t3` text, a count in mono where the step wants more than one,
and a `Decide` chip with the journal key where a step asks a question. Its last
line is `t2` `--gb-faint`. A count that climbs bumps.

**The loader** (`map1.png`'s ROUTE DATA list). A full-view `--gb-void` ground
at `--gb-t-veil`, the city's name in `t7` centred, then one row per stage:
`check` in `--gb-good` when done, an accent diamond while running, `--gb-faint`
while waiting, the label in `t1`, a `220 x 4` bar filled from `done / total` by
`scaleX`. Rows keep their node between pushes so bars fill instead of blinking.
With no stages it is the title alone over the ground, which is the veil over a
train ride.

**The confirm.** A `420px` frame in front of everything, `--cut: 14px`, over
the scrim. What it is about in `t1` `--gb-dim`, the question in `t4`, then Yes
(lit accent, key cap `Enter`) and No (quiet, key cap `Esc`). Yes takes the
focus ring. It rises 12 px like any frame; the scrim under it fades.

**The foot bar** (`map1.png`'s SYSTEM: ACTIVE strip). `88px` tall,
`--gb-panel`, a `1px` `--gb-edge` top rule. One button per face: `18px` icon,
`t1` label, key cap, `--cut: 6px`. The face that is open takes the accent
underline and `--gb-ink`; Leave sits apart at the right with `--gb-danger` on
hover. The bar never animates its own position; only its buttons respond.

**The landing screen** (`gameselect2.jpg` for the wide save bars,
`gameselect.png` for the grid behind them). `--gb-void` ground with a `1px`
`--gb-edge` grid at `48px`, the title in `t7`, then one wide card per city:
`--cut: 14px`, `--gb-solid`, a `160px` band on the left carrying the city's
name over `--gb-hatch` and its `city` icon, then the name in `t6`, the brief in
`t3` clipped to two lines, and a mono readout row: blocks, when it was written,
whether a playthrough waits. The one the player was last in wears an accent
edge and a `Last played` chip. Open is lit, Remove is quiet and asks twice.
Cards stagger in at `--gb-stagger`.

**The creation form** (`gamesettings.jpg`). Two halves of one card: a left list
of sections with an icon each, one selected in accent with the key line, and a
right panel of rows. A row is a label in `t4` with its control at the right: a
text field (`--gb-well`, `1px` `--gb-edge`, accent edge on focus), or a value
between `chevron-left` and `chevron-right`, or a two-state toggle. Every field
is optional and the form says so once, in `t2` `--gb-faint`, rather than
marking each row. Generate is the one lit button, at the foot, with the section
list going quiet while a build runs.

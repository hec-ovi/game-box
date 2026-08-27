# Generating a theme pack

Every image a theme pack needs, what it is for, and the prompt to make it with.
Written to be pasted into any image generator: nothing here depends on a seed, a
negative prompt field or a vendor's parameter, because the consumer tools do not
expose those.

The evidence behind the choices is in `.research/interior-window-textures-2026/`.
Three findings drive everything below.

- A room box computes perspective per pixel from the view ray. If the image
  bakes perspective too, the two multiply and the room reads wrong as you walk
  past. So the faces of a room are **flat elevations**, never photographs taken
  from the window.
- Resolution is nearly free at runtime (256 px to 16 px moved fragment
  performance about 5 percent in the original measurements) but every unique
  layer costs memory. So: fewer, larger, better images, and share what can be
  shared.
- The screen structure of a building-sized ad (the dot matrix, the dark gaps,
  the banding) is applied by the shader over the artwork. **Do not draw it into
  the image.** A fine grid baked into a texture and then shrunk produces moire.

## The folder

```
assets/themes/<theme>/
  theme.json      what each image is and which rooms may use it
  windows/        flat panels: what most windows show
  rooms/          one back wall per kind of room
  faces/          the floor, ceiling and side walls every room shares
  ads/            artwork for the screens on the sides of buildings
```

A pack is that folder. Drop in your own images, name them in `theme.json`, and
the game reads them. Nothing in the code names a picture.

## How to work

1. **Generate large, then shrink.** Ask for the biggest the tool offers (2K or
   4K where it exists). Downsampling four to eight times is also the cheapest
   way to remove artefacts: malformed detail and gibberish lettering disappear
   below the size at which they resolve.
2. **Expect to discard.** No consumer tool exposes a seed, so the workflow is
   generate several and keep the best. About 85 percent consistency across a
   batch is a good result, not 100.
3. **Reuse the identity block word for word.** Rewording it between images is
   the main cause of a pack that does not look like a set.
4. **Say counts, not adjectives.** "Three objects, the rest of the floor bare"
   works. "Minimal, clean" does not.
5. **Name one light source and where it is.** These tools default to even,
   flattering illumination. Say the source, its side of the frame, its colour,
   and say the falloff as a fact.

## The identity block

Paste this at the end of every prompt in the pack, unchanged. It is what makes
fourteen separate generations read as one city.

> Photographic, not illustrated. Dim interior at night. One desaturated
> blue-grey base with warm tungsten as the only warm colour. Low-key lighting,
> deep shadows, most of the frame falling to near black. Slightly underexposed.
> Sharp focus corner to corner. Square image, 1:1. Nothing in the frame is
> readable as text, lettering, numbers, a logo or a label. No people, no animals.

For a different theme, rewrite this block once and keep the rest.

---

# 1. Flat window panels

`assets/themes/<theme>/windows/*.png` &middot; square, 1024 px, downsample to 512

**These carry most of the windows in the city.** No room behind them, no box, no
parallax: a surface seen through glass. They are cheap to draw and they are what
makes the rare detailed room worth looking at. The whole point is that they are
quiet.

Each is a flat surface photographed square-on, filling the frame. There is no
depth in these and there must be no perspective.

**Shared opening for this section**, before the subject line:

> A flat surface directly behind a window, photographed square-on with the
> camera perpendicular to it, filling the whole frame edge to edge, no
> perspective and no converging lines, no window frame and no glass in shot.

| File | Subject line to insert |
|---|---|
| `curtain-drawn.png` | Heavy curtains fully closed across the whole frame, two panels meeting at the centre, soft vertical folds, a thin warm glow escaping the gap where they meet and along the bottom edge. |
| `curtain-open.png` | Curtains pulled to both sides as two vertical bands of fabric at the left and right edges, the middle two thirds a dim bare wall with one warm lamp glow low on the right. |
| `blind-slats.png` | A horizontal slatted blind fully lowered and almost closed, forty even slats across the frame, one warm light behind it drawing thin bright lines along the underside of each slat. |
| `blind-angled.png` | A horizontal slatted blind lowered but tilted half open, the slats showing thin dark gaps, warm light behind reaching through them unevenly, brighter at the bottom. |
| `frosted-glass.png` | A sheet of frosted obscure glass filling the frame, a soft warm blur of one light behind it slightly left of centre, everything else an even cold grey, no shape readable through it. |
| `blank-panel.png` | A flat wall panel of dull painted metal filling the frame, one dim strip light along the top edge washing down, the lower half falling to near black. |
| `concrete-infill.png` | A bricked-up window opening: rough grey blockwork filling the frame edge to edge, the mortar lines a regular grid, no light of its own, lit only faintly from outside the frame. |
| `paper-covered.png` | Sheets of plain paper taped over the inside of the glass, four sheets overlapping, edges curling slightly, one warm light behind making the paper glow evenly. |
| `shutter-steel.png` | A corrugated steel roller shutter pulled fully down, vertical ribs across the whole frame, scuffed and dented near the bottom, no light behind it. |
| `dark-empty.png` | An empty unlit room's near wall, flat bare plaster filling the frame, no fittings and no objects, the faintest cold spill from outside catching the top edge. |

Aim for two or three good versions of each and keep the calmest.

---

# 2. The faces every room shares

`assets/themes/<theme>/faces/*.png` &middot; square, 1024 px, downsample to 512

**Four images, used by every room in the pack.** This is the fix for the side
walls, floor and ceiling all wearing the back wall's picture. They are meant to
be unremarkable: they sit at the edge of vision, in shadow, and their job is to
be a surface rather than a scene.

Author them flat. The shader supplies the angle.

| File | Prompt subject |
|---|---|
| `floor.png` | A floor seen from directly above, camera pointing straight down, filling the whole frame, worn grey vinyl tiles in a regular grid with scuffs and a few darker stains, no objects on it at all, no perspective and no horizon. |
| `ceiling.png` | A ceiling seen from directly below, camera pointing straight up, filling the whole frame, plain suspended ceiling tiles in a regular grid with one flush rectangular light panel slightly off centre, no perspective. |
| `wall-side.png` | An interior side wall photographed square-on, camera perpendicular, filling the whole frame, plain painted plaster with a skirting board along the bottom edge and a faint vertical seam, nothing hanging on it, no perspective. |
| `wall-side-alt.png` | An interior side wall photographed square-on, camera perpendicular, filling the whole frame, exposed grey concrete with a single conduit pipe running vertically at one third across, nothing else on it, no perspective. |

Two side walls are enough: the shader picks between them so opposite walls of a
room are not identical.

---

# 3. Room back walls

`assets/themes/<theme>/rooms/*.png` &middot; square, 1024 px. Street level keeps 1024, upper floors downsample to 512.

**One per kind of room, and this is the only place detail belongs.** The
existing set is too busy: a bar with a back bar, a counter, four stools, a
coffered ceiling and hanging glasses is a whole scene, and a street of whole
scenes is what makes the city read as noisy.

The rule for this pass: **three objects, and one light.** Everything else is
bare wall. A room seen through a window at night is mostly darkness with one lit
thing in it.

These are flat elevations of the wall facing the window, not photographs taken
from the window. No floor and no ceiling in shot.

**Shared opening for this section**, before the subject line:

> The far wall of a small room, photographed square-on with the camera
> perpendicular to it, the wall filling the whole frame edge to edge. No floor,
> no ceiling and no side walls in shot. No perspective, no converging lines, no
> vanishing point.

| File | Subject line |
|---|---|
| `office-desks.png` | Two desks against the wall with one monitor on the left one, glowing pale blue as the only light, the wall above them bare. |
| `office-partition.png` | A frosted glass partition across the right half, a single dark chair against it, one warm downlight at the top left. |
| `server-racks.png` | One tall equipment rack against the wall, its front covered in small steady green and amber indicator lights, the rest of the wall in darkness. |
| `flat-living.png` | A low couch against the wall with one framed picture above it, a floor lamp at the right edge throwing warm light up the wall. |
| `flat-kitchen.png` | A row of plain wall cupboards along the top, a kettle and two mugs on the counter below, one warm strip light under the cupboards. |
| `flat-bedroom.png` | The head of a bed against the wall with two pillows, one small lamp on a bedside table at the left throwing warm light on the wall behind it. |
| `corridor.png` | A bare wall with one closed door slightly right of centre and a single wall light above it, nothing else. |
| `store-room.png` | Metal shelving across the wall holding four plain cardboard boxes, one bare bulb hanging at the left, deep shadow to the right. |
| `bar-bottles.png` | A shelf of bottles along the middle of the wall, backlit from behind so the bottles glow amber and green, the wall above and below in darkness. |
| `noodle-counter.png` | A serving hatch in the middle of the wall with warm light coming through it, two steel pots on the ledge beneath, the rest bare tile. |
| `shop-racks.png` | Two rows of goods on wall-mounted racks, one strip light along the top washing down, the lower third in shadow. |
| `clinic-cabinets.png` | Two white wall cabinets with glass fronts, dimly lit from inside, a cold pale light source out of frame to the left. |
| `workshop-tools.png` | A pegboard with six hand tools hanging on it, one work lamp clamped at the right edge throwing hard warm light across, strong shadows. |
| `lobby-desk.png` | A reception desk against the wall with a low counter light glowing along its front edge, one large blank panel on the wall above it. |

If a room comes back with more than three objects in it, regenerate. The
temptation is to keep the richer image; do not.

---

# 4. Ads and signage

`assets/themes/<theme>/ads/*.png`

**Artwork only. The shader adds the screen.** Do not draw a dot matrix, scan
lines, pixel grid, banding or bloom into these. The game applies the dot matrix
over the top, scaled so the pixel pitch stays physically constant whatever size
the building is, and it can antialias that where a baked one would shimmer.

What makes the reference frames work is not detail, it is contrast: the ad is
the only elaborate thing in sight and everything around it is dark massing. So
each of these is a single bold image, not a busy one.

What makes a generated cyberpunk sign look cheap, and how to avoid it:

- **The default palette.** Electric blue and hot magenta on black is where every
  model lands and it reads as stock. Each ad below names its own two colours.
- **Text.** It turns to noise at the size these are seen. Ask for one or two very
  large glyphs, or none.
- **No black.** A sign with no darkness around it cannot read as emissive.
- **Density in one image.** Real signage density comes from many simple signs at
  different depths, not one crowded picture.

**Shared opening for this section:**

> A flat graphic image filling the whole frame edge to edge, photographed
> square-on with no perspective and no converging lines. Deep black background
> occupying most of the frame. Exactly two saturated colours plus black.

| File | Aspect | Subject line |
|---|---|---|
| `face-portrait.png` | 3:4 tall | A woman's face in three-quarter view, eyes lowered, filling the upper two thirds, rendered in deep red and pale warm white only, the lower third pure black. |
| `face-profile.png` | 3:4 tall | A man's face in profile facing left, filling the left half of the frame, rendered in cold cyan and white only, the right half pure black. |
| `hand-offering.png` | 1:1 | A single hand holding a small round object, centred, rendered in amber and deep orange only, everything around it black. |
| `drink-pour.png` | 3:4 tall | A dark bottle pouring into a glass, centred, the liquid catching light, rendered in green and pale gold only. |
| `glyph-single.png` | 1:1 | One large bold abstract mark like a single stamped character, centred, filling half the frame, in white on black with a thin red outline. |
| `glyph-column.png` | 9:16 tall | Four large abstract vertical marks stacked in a column down the centre of the frame, in warm orange on black. |
| `stripe-ribbon.png` | 21:9 wide | Three horizontal bands of colour running the full width, deep red, black, and pale cyan, the black band twice the height of the others. |
| `product-capsule.png` | 1:1 | A single smooth capsule shape floating centred, lit from the upper left, rendered in white and violet only, deep black around it. |
| `weather-map.png` | 16:9 wide | A simple abstract map outline in thin glowing lines, cyan on black, no text and no labels, occupying the middle half of the frame. |
| `noodle-bowl.png` | 1:1 | A steaming bowl seen from a low angle, centred, rendered in warm red and cream only, steam rising into black. |

Ten is plenty. The city varies them by tint, brightness and which building they
land on, so the same artwork does not read as the same ad twice.

---

## When you have them

Drop each into its folder under `assets/themes/<theme>/` with the filename in
the tables above, and the pack builder picks them up. Anything missing falls
back to what ships, so a half-finished pack still runs.

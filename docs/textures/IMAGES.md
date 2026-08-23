# Image shopping list for Grok

Every image this project wants, in one file. Ordered by what a player notices, so if you stop halfway you have still bought the biggest part of the change.

## Corrections from the first run (2026-08-23)

All 17 landed, plus 8 facade variants. What was learned running them, which
matters more than the images: **the prompts below are the originals, and several
of them cannot hit their own quality bar.** Apply these before regenerating.

**Grok composes when given a list, and light spread is the detector.** Every
prompt with a five-item wear list came back staged: a hero streak or soot blob
with clean edges, recognisable the moment it repeats. Those measured 22 to 50%
light spread against a 7% target. Trimming each list to one or two inherently
uniform features took the same materials to 5 to 9%.

Exact replacements that worked:

- **Entry 1**: wear list becomes `an even film of soot grime and a faint tonal
  difference from one panel to the next`. Cut the water runs, the dust in the
  reveals and the grime line at joins.
- **Entry 2**: `cladding plates` becomes `weathering steel sheet` (the word
  "plates" makes the model give every plate its own rust event), and the wear
  list becomes `a fine even oxide grain over the whole face`. Six attempts on
  the original never got under 10%; the reworded one hit 5.2% first try.
- **Entry 4**: wear list becomes `the shallow horizontal ridging of timber board
  marks pressed into the concrete running across the whole frame and an even
  film of soot grime`. Cutting the wide pale rain runs removed a hero diagonal
  and took it from 49.4% to 5.0%.
- **Entry 5**: `a dark anodised brushed aluminium shopfront surround at street
  level` reliably makes Grok draw an entire shopfront, mullions and all. Use
  `a flat panel of dark anodised brushed aluminium`. But cutting all the wear
  leaves blank grey, so keep `a fine brushed grain running one way, an even dark
  grimy film over the whole face and a scatter of fine scratches through the
  anodising`.
- **Entry 3** needs a tile **count**, not a tile size. "roughly sixty
  centimetres across" gives either 60 cm tiles with a hero smear or a 10 cm
  mosaic that is sub-pixel in game. `five tiles across the frame` pins it. This
  is still the weakest entry in the list: about one generation in fifteen passes.
- **Entries 9, 16, 17**: `taken from outside the building straight through its
  window` makes the model draw a window frame around the room, and the negatives
  do not stop it. Use `camera perpendicular to the far wall so the room fills the
  whole frame edge to edge`.
- **Entries 8 and 13**: the safe-area clause is ignored every time. Fix it in the
  positive list instead: `a single small drink bottle` rather than `tall`, and
  for the figure, cut `shot from slightly below`, which is what plants the
  subject on the bottom edge. Keep `Bold and simple, readable from a long way
  off`, which was tested and helps.

**`a faint tonal difference from one panel to the next` is the single biggest
light-spread driver.** It costs about 3 points on a flat material and 10 on one
that already varies.

**Tone.** Every generation comes back well above the requested RGB 25 to 70, mid
grey or fully saturated. That is fine and applies to every tiling entry, not
only the two that say so: the sampler divides by the image's own mean and
multiplies in linear, so the final darkness is set in code. A near-black source
would only cost tonal resolution and bring JPEG noise with it.

**Running them.** `-p` must come last. "One image per call" does not mean one
call at a time: each `grok` process writes under
`~/.grok/sessions/<url-encoded-cwd>/`, so calls launched from **different
working directories** cannot cross-label each other. Eight concurrent worked
with no mislabelling. Also, `tile.mjs` writes four files into its outdir, so tile
into scratch and copy only the `-tile.png` rather than dropping three review
sheets next to the asset.

**Yield, for planning a future batch.** facade-c passes about 4 in 5, facade-a
and facade-b about 1 in 6, facade-d about 1 in 15. Four variants per facade was
not reachable at the quality bar: 34 candidates produced 8 keepers, and two
consecutive batches of eight produced nothing new, which is a prompt ceiling
rather than a budget one.

**Memory, measured.** The pack stores 256 px layers at 0.35 MB with mips, and a
finish is one layer in each of the two facade strips, so 0.70 MB per material.
The 8 variants are 16 layers and 5.6 MB: the pack goes 16.8 MB over 48 layers to
22.4 over 64, and scene-resident textures 69.1 MB to 74.7 MB. The 17 base entries
add nothing, because they repaint layers that already exist. Downsampling to the
pack's 256 px convention is what makes this cheap: at the delivered 896 px a
layer is 4.28 MB, and the variants alone would cost 68.5 MB.


### Entry 6, the door: the prompt that worked

Twelve attempts. What fixed it, and both are worth reusing:

**"A flat orthographic elevation, no perspective"** is what stops Grok
photographing an open lit lobby. **Symmetry is a post step, not a prompt
problem**: best raw symmetry over six candidates was 2.6/255, and mirroring the
left half over the right fixes it exactly. Half the city draws its building
mirrored, so exact symmetry is not optional.

```
A flat orthographic elevation of a pair of shut glazed entrance doors in a dark
anodised aluminium frame set in a plain dark concrete wall, no perspective, seen
straight on and centred on the join between the two leaves, perfectly symmetric
left to right. Two identical leaves, each a single tall pane of dark glass with a
horizontal rail below it and a brushed metal kick plate at the foot, a slim
vertical pull on each leaf either side of the join, and one plain glazed fanlight
running the full width above them. Behind the glass a dim unlit lobby, so the
doors read as shut and locked at night. A narrow plain dark wall margin of about
one twentieth of the frame on all four sides. Evenly lit, slightly underexposed,
sharp corner to corner.
```


## How to run one

One image per call. Batched calls come back numbered by completion order, not call order, and get mislabelled.

```bash
mkdir -p ~/gen && cd ~/gen && grok --always-approve --disable-web-search -p \
 "Use image_gen once, aspect_ratio 1:1, no other tools, no commentary.
  Prompt: <paste the fenced prompt from one entry, verbatim>
  Then print the absolute file path."
```

Everything comes back as a 1024x1024 JPEG under `~/.grok/sessions/<encoded-cwd>/<uuid>/images/N.jpg`. Copy it out and rename it to the source name each entry gives.

## Where the files go

Three destinations, and only one of them takes the raw file directly.

- **Tiling surfaces** (entries 1 to 5, 10, 11, 12): the raw JPEG goes through `tools/textures/tile.mjs`, and the tool's output is what lands in the repo. Each entry gives the exact command.
- **Screens and the door** (entries 6, 7, 8, 13, 14, 15): convert to PNG and drop it straight in. From the repo root:
  ```bash
  node --input-type=module -e "import sharp from 'sharp';await sharp('/abs/in.jpg').png().toFile('/abs/out.png')"
  ```
- **Rooms** (entries 9, 16, 17): leave them as JPEG, named `<name>.jpg`, in `assets/gen/rooms/`. Do not put them in `game/prefab/rooms/`; that folder holds the tool's output, and a raw file dropped there ships the painted wall around the room. `game/prefab/tools/draw-rooms.ts` currently loops all twelve committed room names and needs every raw beside it, so processing one new room is a code change on our side. Just deliver the JPEGs.

`game/prefab/finishes/` and `game/prefab/screens/` do not exist yet. Create them.

## The tiling tool

```bash
node tools/textures/tile.mjs <image.jpg> <outdir> [--metres N] [--tame 0.3] [--flatten 0.6] [--pot]
```

1024 in, 896 out, or 512 out with `--pot`. It writes `<name>-tile.png` plus three sheets to look at: `<name>-4x4.png` (the repeat), `<name>-4x4-raw.png` (the repeat before the cut) and `<name>-scale.png` (the tile on an 8 m wall with a 2.1 m door drawn on it). `--metres` only labels the console report and the scale sheet; it does not change the tile.

## How to check one landed

Read the two lines the tool prints:

```
source   1024x1024  seam x 2.41 y 3.02  light spread 7.6%
tile      896x896   seam x 1.13 y 1.09  light spread 6.0%
```

Seam under about 1.5 on both axes is good, above 2 is visible. Light spread under about 7% means no corner is brighter than the middle. Then open `<name>-4x4.png` and look for a repeating landmark, and open `<name>-scale.png` to see whether the wear is the right size next to a door. If a landmark shows, regenerate rather than trying to fix it.

For screens, rooms and the door there is no measurement. Look at the file, and shrink it to 256 px to see what the game actually stores.

---

## 1. Facade A, corpo blue-grey cladding

Save as: `game/prefab/finishes/facade-a.png` (896x896 after tiling)
Source name: `facade-a.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: the wall surface of a quarter of the city. Today it is a flat near-black field with an 11 byte range across the whole image. This one image is most of the quality jump.
Note: the image supplies grain only. The sampler divides by the image's own mean and multiplies in linear, so how dark the wall ends up is set in code, not here. A near-black source would only cost tonal resolution and bring JPEG noise with it.

```
Seamless tileable texture of dark blue-grey composite rainscreen cladding panels on a tall office building, albedo colour map only. Base colour in the deep desaturated cool blue-grey range, RGB values between 25 and 70, no light source in the image and no cast shadows, uniform flat illumination. Flat orthographic elevation view with no perspective and no vignette, sharp from corner to corner. The frame covers three metres by three metres of real cladding: broad soot washing, pale water runs streaking downward, a faint tonal difference from one panel to the next, dust settled along the shallow reveals and a thin grime line where two panels meet, every feature at least twenty centimetres across, at even density across the whole frame, with no single streak, stain or patch recognisable twice. The pattern continues off all four edges and wraps. The cladding fills the entire frame edge to edge with no margin, with no windows, no glass, no window frames and no doors. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/facade-a.jpg ~/gen --metres 3
cp ~/gen/facade-a-tile.png game/prefab/finishes/facade-a.png
```

## 2. Facade B, weathering steel

Save as: `game/prefab/finishes/facade-b.png` (896x896 after tiling)
Source name: `facade-b.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: the warm family, another quarter of the city, and the only warm facade in the set.
Note: same as entry 1, the tone is set in code and the image supplies grain.

```
Seamless tileable texture of dark oxidised weathering steel cladding plates on a building, albedo colour map only. Base colour in the deep desaturated red-brown range, RGB values between 25 and 70, no light source in the image and no cast shadows, uniform flat illumination. Flat orthographic elevation view with no perspective and no vignette, sharp from corner to corner. The frame covers three metres by three metres of real cladding: broad patches of dark rust bloom, long dried runs where water has carried oxide down the face, soot darkening, a faint tonal difference from one plate to the next and a thin dirt line along each plate join, every feature at least twenty centimetres across, at even density across the whole frame, with no single bloom, run or patch recognisable twice. The pattern continues off all four edges and wraps. The steel fills the entire frame edge to edge with no margin, with no windows, no glass, no window frames and no doors. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/facade-b.jpg ~/gen --metres 3
cp ~/gen/facade-b-tile.png game/prefab/finishes/facade-b.png
```

## 3. Facade D, dark glazed ceramic tiling

Save as: `game/prefab/finishes/facade-d.png` (896x896 after tiling)
Source name: `facade-d.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: the coolest family, another quarter of the city. A tile grid is the one facade material that still reads as pattern at 21 pixels per metre instead of turning into noise.
Note: this is the one request in the list with a regular grid, and both the model and the quilting cut are weakest there. The cut picks its path where pixels agree, without knowing about the grid, so grout lines can jog at the join. Ask for large tiles (the prompt does), check the 4x4 sheet, and expect this one to be the most likely to need a second generation.

```
Seamless tileable texture of large dark glazed ceramic tile cladding on a building, albedo colour map only. Base colour in the deep desaturated teal-blue range, RGB values between 25 and 70, no light source in the image and no cast shadows, uniform flat illumination. Flat orthographic elevation view with no perspective and no vignette, sharp from corner to corner. The frame covers three metres by three metres of real cladding: a regular grid of large tiles roughly sixty centimetres across with narrow dirty grout lines between them, broad soot washing across whole runs of tiles, a few tiles sitting a shade off their neighbours, chipped corners and dust settled in the grout, all the staining at even density across the whole frame, with no single chip, stain or off tile recognisable twice. The pattern continues off all four edges and wraps, with whole tiles meeting at the edges. The cladding fills the entire frame edge to edge with no margin, with no windows, no glass, no window frames and no doors. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/facade-d.jpg ~/gen --metres 3
cp ~/gen/facade-d-tile.png game/prefab/finishes/facade-d.png
```

## 4. Facade C, board-marked precast concrete

Save as: `game/prefab/finishes/facade-c.png` (896x896 after tiling)
Source name: `facade-c.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: the neutral family, another quarter of the city, and the one the neon reads against best.
Check first: `tools/textures/example/wall-concrete-dark.png` is already in the repo at this spec (896x896, dark grimy precast concrete, seam 1.13 / 1.09) and nothing uses it. If the board marking is not worth a generation to you, we copy that file and skip this entry. The prompt below is only for the board marking.

```
Seamless tileable texture of dark board-marked precast concrete wall panels on a building, albedo colour map only. Base colour in the neutral desaturated charcoal range with no colour cast, RGB values between 25 and 70, no light source in the image and no cast shadows, uniform flat illumination. Flat orthographic elevation view with no perspective and no vignette, sharp from corner to corner. The frame covers three metres by three metres of real wall: the shallow horizontal ridging of timber board marks pressed into the concrete running across the whole frame, broad soot staining, wide pale runs where rain has washed the face unevenly, dust gathered in the recesses and a grime line at each panel join, every feature at least twenty centimetres across, at even density across the whole frame, with no single stain, run or mark recognisable twice. The pattern continues off all four edges and wraps. The concrete fills the entire frame edge to edge with no margin, with no windows, no glass, no window frames and no doors. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/facade-c.jpg ~/gen --metres 3
cp ~/gen/facade-c-tile.png game/prefab/finishes/facade-c.png
```

## 5. Street surround, anodised aluminium

Save as: `game/prefab/finishes/street-surround.png` (896x896 after tiling)
Source name: `street-surround.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: the pier, head and cill that shopfront glazing is cut out of, shared by all four families. It is the closest wall surface to the player and the only one he ever stands a metre from. Street level gets twice the pixels per metre of the upper floors, so it can carry finer wear than the facades.

```
Seamless tileable texture of a dark anodised brushed aluminium shopfront surround at street level, albedo colour map only. Base colour in the neutral dark gunmetal grey range with only a faint warm grime cast, RGB values between 25 and 70, no light source in the image and no cast shadows, uniform flat illumination. Flat orthographic elevation view with no perspective and no vignette, sharp from corner to corner. The frame covers two metres by two metres of real metal: a fine brushed grain running one way, a dark grimy film over the whole face, hand smears and rub marks, splash staining and road grit, small dents and scratches through the anodising, every feature at least ten centimetres across, at even density across the whole frame with no band of it heavier at the bottom, and no single dent, smear or scratch recognisable twice. The pattern continues off all four edges and wraps. The metal fills the entire frame edge to edge with no margin, with no glass, no window, no door and no handle. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/street-surround.jpg ~/gen --metres 2
cp ~/gen/street-surround-tile.png game/prefab/finishes/street-surround.png
```

## 6. Entrance doors

Save as: `game/prefab/screens/../finishes/door.png`, that is `game/prefab/finishes/door.png` (1024x1024 PNG, no tiling)
Source name: `door.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: the entrance on every building in the city, currently 24 hand-placed rectangles. Roughly seven buildings in eight have a door nobody opens that is still the nearest thing to the pavement.
Two things the picture has to satisfy: a wide plain dark margin all round, because the producer wraps the outer 1/25 of the image onto the four reveals of the plate, and nothing may depend on its aspect, because it gets stretched onto doors from 1.4 m to 2.6 m wide. No card reader in the picture: the loader mirrors the left half over the right, so anything on one side comes out twice. Code paints the reader after the mirror.

```
A photograph taken straight on at night of a pair of glazed entrance doors in a dark metal frame set in a plain dark wall, camera perpendicular to the doors and centred on the join between them, perfectly symmetric left to right. Two identical glass leaves meeting in the middle, a slim vertical pull on each leaf either side of the join, a horizontal rail across each leaf below the glass, a brushed metal kick plate at the bottom, and a glazed fanlight across the full width above them. Behind the glass a warm tungsten-lit lobby fading away into depth, and warm light spilling onto the threshold, so the doors are lit only from inside and the metal frame stays dark. A plain dark wall margin of roughly one tenth of the frame all the way round the doorway on every side. Sharp focus from corner to corner, slightly underexposed, deep shadows with no blown highlights. No card reader, no keypad, no intercom, no handle plate and no hardware other than the pulls, rail and kick plate. No steps, no ramp, no kerb, no street, no pavement markings, no plants, no people and no reflection of anything outside in the glass. Plain unmarked image with no lettering, no numbers, no logo, no signage, no watermark, no border, no frame and no lens flare.
```

## 7. Advert 1, portrait

Save as: `game/prefab/screens/portrait.png` (1024x1024 PNG, no tiling)
Source name: `portrait.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: one of six adverts on the city's lit wall panels, today a drawn magenta ramp with an oval for a head. Screens are the biggest bright surfaces on a street.
Safe area, and this is the part that is easy to get wrong: the picture lands on boards of different shapes and gets cropped, never letterboxed. Only the middle 55% of its height and the middle 67% of its width are guaranteed to be seen. Everything that matters sits inside that, and nothing runs along an edge. The game draws its own lamp grid, housing and rim light over the picture, so none of that belongs in the image.

```
A square photograph as it would appear on a large outdoor advertising screen: a close-up head and shoulders portrait of a stylised model with dyed hair and reflective eyewear, lit from one side, against a deep saturated magenta and crimson background. The head is centred and sits well inside the middle half of the frame, with generous empty background above it, below it and to both sides, so a crop into the middle of the picture loses nothing. One hard-edged saturated cyan graphic bar running horizontally across the lower middle of the frame behind the shoulders, ending well short of the left and right edges and nowhere near the bottom edge. Bold and simple, readable from a long way off, evenly exposed with detail held in the dark areas and no blown-out highlights. Not a recognisable real person. Plain unmarked image with no lettering, no numbers, no logo, no signage, no watermark, no barcode, no border, no frame, no screen bezel, no pixel grid, no scanlines, no moire, no glow, no halo, no bloom and no lens flare.
```

## 8. Advert 2, bottle

Save as: `game/prefab/screens/bottle.png` (1024x1024 PNG, no tiling)
Source name: `bottle.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: advert 2 of 6, today a teal ramp with a white capsule. A product shot is the most recognisably photographic of the six, and teal is the palette's dominant.
Safe area: only the middle 55% of the height and the middle 67% of the width are guaranteed to survive the crop. Nothing along any edge.

```
A square photograph as it would appear on a large outdoor advertising screen: a single tall drink bottle of pale blue glass standing upright and centred, backlit so the liquid inside glows, with condensation on the glass, against a deep saturated dark teal background falling to near black. The bottle is centred and sits well inside the middle half of the frame, with generous empty background above it, below it and to both sides, so a crop into the middle of the picture loses nothing. One hard-edged saturated amber graphic bar running horizontally across the lower middle of the frame, ending well short of the left and right edges and nowhere near the bottom edge. Bold and simple, readable from a long way off, evenly exposed with detail held in the dark areas and no blown-out highlights. Plain unmarked image with no lettering, no numbers, no logo, no label, no signage, no watermark, no barcode, no border, no frame, no screen bezel, no pixel grid, no scanlines, no moire, no glow, no halo, no bloom and no lens flare.
```

## 9. Office reshoot

Save as: `assets/gen/rooms/office-desks.jpg` (raw JPEG, we process it)
Source name: `office-desks.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: replacing the palest, flattest picture in the whole pack (mean 65,67,67 at 6.6% saturation, where the next lowest is 17.2%). This is exactly the white-concrete look you are objecting to, and it sits behind roughly one window in six above 4.6 m across the entire city.
Leave it as a JPEG. The tool crops the painted wall off the edges itself.

```
A photograph looking into the interior of an open plan corporate office on an upper floor at night, taken from outside the building straight through its window, camera perpendicular to the far wall so the room fills the whole frame edge to edge. Rows of low desks with dark monitors, wheeled chairs pushed in, a dark polished concrete floor, near black exposed ducting and cable tray across the ceiling, a smoked glass partition to one side and a single tall plant in the corner. Dark charcoal walls, near black, not white and not pale. Lit only by the room's own lights: continuous linear strips recessed in the ceiling running cool cyan-white, a faint amber standby glow on one monitor, and a cool wash down the partition, so the light falls off towards the near edges of the frame. One point perspective with the far wall square to the camera, sharp focus from corner to corner, underexposed so the corners fall away into darkness. No window frame, no glass, no reflection, no curtain, no blind, nothing between the camera and the room, and no view of the street or the outside. No people. Plain unmarked image with no lettering, no numbers, no signage, no logo, no label, no watermark, no border and no frame.
```

## 10. Corpo interior wall concrete

Save as: `assets/gen/wall-concrete-corpo-tile.png` (512x512 after tiling)
Source name: `wall-concrete-corpo.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: every corpo wall and ceiling inside a building. It replaces the last third-party image left inside an interior, a mid grey (mean 127) from a downloaded pack, which is the exact tone you are reacting to. Once this lands, interiors owe nothing to a foreign licence.
Note: mid grey is what to ask for. The code divides the image by its own measured mean, so the darkness has to come from the paint values in `surfaces.ts`, and a near-black source would only lose tonal steps and add JPEG noise. This is an interior wall: clean and well finished, with the grime left outside.
Check first: `tools/textures/example/wall-concrete-dark.png` is already in the repo at the same format and size. The difference is the wear list (that one was prompted as a grimy street wall), so this generation is worth spending only if you want the clean corpo version.

```
Seamless tileable texture of dark board-formed architectural concrete on an interior wall of a modern corporate building, clean and well finished, albedo colour map only. Base colour in the neutral desaturated mid grey range with no colour cast, RGB values between 60 and 110, no light source in the image and no cast shadows, uniform flat illumination. Flat orthographic elevation view with no perspective and no vignette, sharp from corner to corner. The frame covers two metres by two metres of real wall: fine even cement grain, faint timber board grain pressed into the surface, small regular form-tie dimples, a scatter of tiny air pockets and the barest tonal mottling from the pour, at even density across the whole frame, with no single mark, dimple or patch recognisable twice. The pattern continues off all four edges and wraps. The concrete fills the entire frame edge to edge with no margin. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/wall-concrete-corpo.jpg assets/gen --metres 2 --pot
```

`--pot` matters. Without it the pack's own resize runs later and is not wrap-aware, which puts part of the seam back.

## 11. Corpo polished floor

Save as: `assets/gen/floor-concrete-corpo-tile.png` (512x512 after tiling)
Source name: `floor-concrete-corpo.jpg` | aspect_ratio 1:1 | must tile | sRGB
What it is for: the corpo floor, which today wears a wall photograph laid flat, so vertical rust weeping runs sideways across it. The floor is the biggest surface in view inside a room and the one the reflection probe picks up.
Note: mid grey again, for the same reason as entry 10. At 512 px over a 3 m frame this lands at 170 pixels per metre, so the wear has to be coarse enough to read there.

```
Seamless tileable texture of dark polished poured concrete floor in a modern corporate building, albedo colour map only. Base colour in the neutral desaturated mid grey range with only the faintest cool variation, RGB values between 60 and 110, no light source in the image and no cast shadows, no reflections of anything, uniform flat illumination. Orthographic straight down view with no perspective and no vignette, sharp from corner to corner. The frame covers three metres by three metres of real floor: faint circular grinder swirl from the polishing pass, fine exposed aggregate speckle, a low haze of foot scuffing, hairline shrinkage lines and the barest dust settling, at even density across the whole frame, with no single scuff, mark or patch recognisable twice. The pattern continues off all four edges and wraps. The concrete fills the entire frame edge to edge with no margin. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/floor-concrete-corpo.jpg assets/gen --metres 3 --pot
```

## 12. Garment shell fabric

Save as: `assets/gen/fabric-coated-shell-tile.png` (896x896 after tiling)
Source name: `fabric-coated-shell.jpg` | aspect_ratio 1:1 | must tile | greyscale data, not a displayed colour
What it is for: the grain multiplied into the cloth of all twelve NPC outfits. Today those garments are a flat repainted colour, which reads as vinyl under neon. This is the one image that acts on every person on screen.
Note: neutral mid grey, no tint. The build divides it by its own luminance mean so it sits around 1.0 and only modulates, and any colour cast in the image would tint the entire wardrobe palette. The frame is 2 m, which lands the tile one to one on the character atlas with nothing thrown away. No ripstop grid or any other regular lattice: the wrap cut is phase-blind and would offset the lattice at the join, showing a jog on every repeat.

```
Seamless tileable texture of matte black coated technical shell fabric, the kind a modern hard-shell jacket is cut from, albedo colour map only. Base colour a neutral mid grey with no tint and no colour cast, RGB values between 100 and 150, no light source in the image, no cast shadows, no specular highlight and no sheen band, uniform flat illumination. Flat orthographic straight on view with no perspective and no vignette, sharp from corner to corner. The frame covers two metres by two metres of real fabric: a tight even woven grain, a faint quilted flex-crease structure at a large scale, soft broad wrinkle relief and the barest fibre lint, every feature at least four millimetres across, at even density across the whole frame, with no seam, stitch line, zip, label, fold or crease recognisable twice, and no regular grid or lattice of any kind. The pattern continues off all four edges and wraps. The fabric fills the entire frame edge to edge with no margin. Plain unmarked image with no lettering, no watermark, no signature, no border, no frame and no drop shadow.
```

Then:
```bash
node tools/textures/tile.mjs ~/gen/fabric-coated-shell.jpg assets/gen --metres 2 --tame 1 --flatten 0.6
```

`--tame 1` is deliberate. The default pulls the brightest 6% of pixels back, and on a flat evenly lit grain scan that 6% is the grain itself.

## 13. Advert 3, figure

Save as: `game/prefab/screens/figure.png` (1024x1024 PNG, no tiling)
Source name: `figure.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: advert 3 of 6, today two stacked ovals standing in for a body. It carries the wardrobe language onto the street, which the low-poly bodies cannot.
Safe area: middle 55% of the height, middle 67% of the width. The bars have to sit inside that, not along the edges.

```
A square photograph as it would appear on a large outdoor advertising screen: a full-length standing figure in a sharply tailored dark technical coat with a high collar and chunky boots, shot from slightly below against a deep saturated amber and crimson background, rim lit down one edge so the silhouette reads hard. The figure is centred and sits well inside the middle half of the frame, with generous empty background above the head, below the boots and to both sides, so a crop into the middle of the picture loses nothing. One hard-edged saturated lime green graphic bar running horizontally across the upper middle of the frame and one solid dark band across the lower middle, both ending well short of the left and right edges and both well away from the top and bottom edges. Bold and simple, readable from a long way off, evenly exposed with detail held in the dark areas and no blown-out highlights. Not a recognisable real person. Plain unmarked image with no lettering, no numbers, no logo, no signage, no watermark, no barcode, no border, no frame, no screen bezel, no pixel grid, no scanlines, no moire, no glow, no halo, no bloom and no lens flare.
```

## 14. Advert 4, noodle bowl

Save as: `game/prefab/screens/bowl.png` (1024x1024 PNG, no tiling)
Source name: `bowl.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: advert 4 of 6, today a green ramp with an oval and three verticals for steam. The warm food advert is what makes a night street read as inhabited, and it pairs with the noodle counter already in the street bank.
Safe area: middle 55% of the height, middle 67% of the width. The magenta bar sits just left of centre, not on the left edge, or it gets cropped off on a banner.

```
A square photograph as it would appear on a large outdoor advertising screen: a steaming bowl of noodles shot from slightly above, warm and richly lit, steam rising in three soft plumes, against a very dark moss green and black background. The bowl is centred and sits well inside the middle half of the frame, with generous empty background above the steam, below the bowl and to both sides, so a crop into the middle of the picture loses nothing. One hard-edged saturated magenta vertical bar standing just left of centre, well inside the frame, not touching the top, bottom or left edge. Bold and simple, readable from a long way off, evenly exposed with detail held in the dark areas and no blown-out highlights. No people and no hand holding chopsticks. Plain unmarked image with no lettering, no numbers, no logo, no signage, no watermark, no border, no frame, no screen bezel, no pixel grid, no scanlines, no moire, no glow, no halo, no bloom and no lens flare.
```

## 15. Advert 5, ink bloom

Save as: `game/prefab/screens/bloom.png` (1024x1024 PNG, no tiling)
Source name: `bloom.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: advert 5 of 6, today three concentric ovals and a white sweep, the most obviously synthetic of the six. The gain here is the smallest of the adverts, because the drawn version was nearly right, but a photographed plume gives the lamp grid real structure to break up.
Safe area: middle 55% of the height, middle 67% of the width.

```
A square photograph as it would appear on a large outdoor advertising screen: a swirling plume of cyan and violet ink dispersing in dark water, shot close, with a bright white core at its centre, against a deep saturated violet falling to black. The plume is centred and sits well inside the middle half of the frame, with dark empty water above it, below it and to both sides, so a crop into the middle of the picture loses nothing. Bold and simple, readable from a long way off, evenly exposed with detail held in the dark areas and no blown-out highlights. Plain unmarked image with no lettering, no numbers, no logo, no signage, no watermark, no border, no frame, no screen bezel, no pixel grid, no scanlines, no moire, no halo and no lens flare.
```

## 16. Server room

Save as: `assets/gen/rooms/server-racks.jpg` (raw JPEG, we process it)
Source name: `server-racks.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: a new room behind the upper windows. The upper bank is six pictures covering every window above 4.6 m in a city that is mostly three and four storeys, so it repeats hardest, and five of its six are washed out. This adds the one room type that puts saturated cold light behind a window.

```
A photograph looking into the interior of a small server room on an upper floor at night, taken from outside the building straight through its window, camera perpendicular to the far wall so the room fills the whole frame edge to edge. Two rows of black equipment racks running away from the camera with a narrow aisle between them, perforated rack doors, thick bundles of cable dropping from an overhead tray, a raised floor of dark panels and a wall of dark patch panels at the far end. Lit only by the room's own lights: dense fields of small cyan and green indicator lamps across the rack fronts and one cold blue-white strip over the aisle, so the light falls off towards the near edges of the frame. One point perspective with the far wall square to the camera, sharp focus from corner to corner, underexposed so the corners fall away into darkness. No window frame, no glass, no reflection, no curtain, no blind, nothing between the camera and the room, and no view of the street or the outside. No people. Plain unmarked image with no lettering, no numbers, no signage, no logo, no label, no watermark, no border and no frame.
```

## 17. Apartment bedroom

Save as: `assets/gen/rooms/flat-bedroom.jpg` (raw JPEG, we process it)
Source name: `flat-bedroom.jpg` | aspect_ratio 1:1 | not tiled | sRGB
What it is for: a second new upper-bank room, in the home language from LOOK.md (moulded plastic, rounded built-ins, light coves, closer to a ship cabin). The bank has two flats against two offices today, and a residential street shows the flats constantly.

```
A photograph looking into the interior of a small apartment bedroom at night, taken from outside the building straight through its window, camera perpendicular to the far wall so the room fills the whole frame edge to edge. A low bed built into a moulded plastic surround against the far wall, rounded built-in storage running along one side, a recessed niche with a few objects in it, a rumpled dark cover and a plastic floor, closer to a ship cabin than a flat. Lit only by the room's own lights: a warm light cove running under the ceiling, a soft strip glowing under the bed base and the cold spill of a small screen on the side wall, so the light falls off towards the near edges of the frame. One point perspective with the far wall square to the camera, sharp focus from corner to corner, underexposed so the corners fall away into darkness. No window frame, no glass, no reflection, no curtain, no blind, nothing between the camera and the room, and no view of the street or the outside. No people. Plain unmarked image with no lettering, no numbers, no signage, no logo, no label, no watermark, no border and no frame.
```

---

## Asked for and dropped

Nothing here is forgotten, it was checked against the code and does not pay.

**Sixth advert, city skyline.** The drawing code already composes it clause for clause: six hard black bands over an ice-to-cyan ramp, a haze mass above the rooftops, an amber bar at the bottom. Stored at 256 px behind a lamp grid, and the crop throws the amber bar away regardless. A photograph buys nothing.

**Perforated nano floor tile.** At 512 px over a 0.5 m tile the perforations are a 3 pixel period and the weave between them is smaller than a pixel, so one mip down it is flat grey. It also breaks the pack's rule that no packed image carries a regular structure, because the wrap cut wanders across rows of holes and halves them. The shader already draws a perforated deck lattice from arithmetic, at any resolution, for free.

**Cloud dome and stratus dome skies.** The sky box already paints its own full-sky sheet from the world seed, as a function of direction, so it is seamless by construction with no pole pinch, and it is different in every world. A baked bitmap would be the same clouds in every world, and it cannot respond to weather, which is driven per frame. Grok also renders the lower hemisphere as a second unrelated sky, so a full sphere is not on offer anyway.

**Horizon glow band.** It would sit behind an opaque mountain ring. Every theme closes the whole compass from 0 to about 10 degrees of elevation, and the proposed ramp dies at 12, so at most a 2 degree sliver of empty sky would ever show. The warm sodium glow lifting off the rooftops is already computed, all round the compass, at the same elevation.

**Moon albedo map.** The moon covers about 32 screen pixels and the disc lands in 64 texels of a 128 px face, so a 512 px map would be thrown away eight to one. The real complaint is four numbers in the moon code (halo size, rock colour, fog flag, angular size). Fix those, generate nothing.

**Road asphalt and pavement concrete tiles.** Every street and pavement cell is covered by a second lifted mesh whose opacity floors at 62% and goes to 100% when wet or dirty, and that film already paints the chippings, tyre polish, gutter staining and dug-up patches over a near-black asphalt. At best 38% of the tile ever reaches the eye, only on a bone dry clean road. The light surfaces you are seeing are the kit's brick and trim walls, not the ground, which is why the list spends the generations on walls.

**Clutter wear tile.** No consumer and no route to one: the box that would use it cannot import from the pack that would hold it without inverting a dependency the isolation check enforces. A seeded wrapping noise texture with a speckle channel is already built and already alive in that same box, and sampling it costs nothing.

**Second fabric tile, polymer pebble.** The mapping it exists for cannot be written. The fabric names in the wardrobe are hue classifications, not materials: the same name is a glowing neon strip on one outfit part and a shoe on another. And at the resolution available the requested 8 mm pebble is under 4 pixels, so it would be the shell tile at a different repeat rate, which is a number rather than an image.

**Hair strand tile.** The pack already ships two 2048 px greyscale strand maps plus matching normals, UV-aligned to the hair cards, and they ship today untouched. Hair reads flat because the map uses a quarter of the available range (110 to 176 of 255), which a levels stretch fixes with no generation and no risk of misalignment. A uniform vertical tile would cross-hatch every island whose clumps do not happen to run vertically.

Also trimmed on the way through, so you do not pay for them: no normal map derived from the garment tile (the pack's hand-aligned normal is better than anything Sobel would produce), no roughness map either (the shipped ORM map is aligned and only needs its blue channel zeroed), and the corpo interior wall is added alongside the existing plaster source rather than replacing it, because eight looks and the only normal map in the pack hang off that entry.
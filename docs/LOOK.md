# The look

Settled by the repo owner with reference images, 2026-08-23. His words are
quoted; everything else is what they imply for a box.

References live outside the repo in `~/Downloads`: `city2..city6`, `char1`,
`character`, `characters`, `interior1..interior8`.

## The whole thing

Cyberpunk, at night. Not one reference is a daylight scene. Neon is the light
source and most of the detail; architecture is close to silhouette behind it.
The ground is wet and mirrors the signs. Heavy haze separates near from far.
Saturated cyan and teal dominant, magenta, amber and green as accents, against
near-black surfaces. Everything bright wears a soft halo.

## People

> "modern futuristic suits, and nanofabric materials, modern. think of net
> runners like style"

Sharp tailoring, not armour. Suit jackets, high collars, technical coats.
Materials that read as coated or synthetic rather than woven: a sheen that
moves, not cloth. Dyed hair, eyewear, chunky modern boots. Dark base with one
saturated accent per person.

Hard limit: the bodies are low-poly CC0 Quaternius on a 65-joint skeleton, and
no CC0 modern wardrobe exists for that rig (24 sources checked, all failed).
So the target is silhouette, palette and material response, not fidelity.

## Streets

> "for exteriors, high quality, futuristic materials, and dystopic, garbage,
> containers with trash, high quality buildings"

Two things at once, and both are needed or it reads wrong. The buildings are
good: clean, tall, expensive-looking, well-lit. The street they stand on is
not: refuse, containers, stacked crates, cabling, puddles, grime at the kerb.
The contrast between the two is the genre.

Wet ground doing real reflection carries more of this than any prop does.

## Interiors, two languages

> "for interiors think of high quality modern corpo buildings, and for houses
> something like spaceship interiors like, like plastic"

**Corpo**: open floors, polished concrete, exposed structure and ducting
overhead, linear light strips as architecture rather than lamps, glass
partitions, desks in rows, plants as the one soft thing.

**Home**: moulded plastic surfaces, rounded built-in furniture, light coves in
the ceiling and under seating, a big window onto the skyline. Closer to a ship
cabin than a flat.

Common to both: light strips are architecture, floors are polished and
reflect them, services are exposed, plants soften.

## How each of these gets built

> "once we have the technique, all would be adding more space and thats it,
> and distribution"

One agent, one thing, and what it delivers is a **technique with a bounded
cost**, not a quantity of content. A sign, a wet road, a corpo floor: each is
solved once, at a fixed draw and memory cost, and then a bigger city is
placement and distribution rather than more work.

So every brief carries the same two requirements:

- **Bounded.** Draws and memory must not grow with how many of the thing there
  are. One instanced or batched layer, joined to the scene's existing
  `BatchedMesh` per material. Measured before and after, reported.
- **Distributable.** Where the things go is seeded and separable from how they
  are made, so the placement can be retuned without touching the technique.

The city already proves the shape: 1,069 draws became 46 and the frame went
18.14 ms to 2.49 ms by making the count stop mattering.

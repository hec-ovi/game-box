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

The kit itself is meant to be small:

> "we can have a kind of floor, a kind of wall, and some furnish, and how they
> fit characters, some beds, desktops, tables. from there we simply randomize"

So: one floor, one wall, and a short list of furniture that a body demonstrably
fits, then seeded placement does the rest. Fitting the body is part of the
spec, not a later polish pass, because it is the thing that has read as broken
on screen: seats were 7 to 15 cm too low because the fit scaled a bounding box
whose top was the backrest, and staff stand 0.60 m off a counter their lean
clip reaches 0.10 m in front of.

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

## Placing things in a room

> "the important part are corners, distances, etc, think of it as a matrix of
> spaces we use, so with a minimum, and no collisions, etc"

A room is a matrix of cells, the same way the city is. A piece of furniture is
a rectangle of cells and it claims them, so two things cannot occupy the same
space by construction rather than by a test that might miss. Corners, minimum
gaps and the clearance a body needs to stand or sit at a thing are properties
of the matrix, not of each prop.

This is the pattern the owner's own `glb-buildings` toolkit already uses on
building faces: "Every face divides into 10 cm cells. A window, a door, a
balcony, a panel or a lit screen is a rectangle of them, and each one claims
the cells it stands on, so two can never overlap."

Getting this right is what makes "from there we simply randomize" safe.

## Furniture is generated, not modelled

> "i am trying to avoid the artistic side, and see how much we can automate,
> we will find a way, maybe not models, but like primitive tables etc, we
> polish them, like one side sharp, the other circular, and make variations
> from there, so we keep the dynamic creation flexible enough. so a position
> is a position and all tables have same height, just add some elements or
> textures, and we good"

A prop is built from parameters, not loaded from a file. A table is a slab on
legs; the variation is in the profile (one edge sharp, one radiused), the leg
form, the proportions, the panel details, the material and any lit trim.

**Height is a contract, not a measurement.** Every table stands at exactly
`tableHeight`, every seat at exactly the seat height, every counter at its
counter height. A body's animation is written against those numbers, so making
them exact by construction removes a whole class of bug rather than fixing it
each time. Both of today's visible faults came from height being whatever a
model's bounding box happened to be: seats 7 to 15 cm too low because the top
of a chair is its backrest, and staff standing 0.60 m off a counter.

**A position is a position.** Where a thing goes is a cell rectangle in the
room matrix. What it looks like is independent of that, so the two can be
retuned separately, which is what keeps the generation flexible.

What this buys, beyond the look: no asset licence to chase, deterministic from
a seed, and one shared material, so the whole room batches.

Say what a {{word}} is in this city. The history named it as a kind of place the
town is built out of, and the engine has no such kind: it knows how to raise a
building from a handful of choices, and those choices are what you make here.
Every one of them is a value from a closed list, and the town is raised from
them by arithmetic you never see.

Theme: {{theme}}
What the town is about:
{{premise}}

The kinds of place every town already has, which this one is not: {{presets}}.

## Words

`word` is {{word}}, the key the file knows it by. `label` is what a person here
says out loud for it, lowercase. `blade` is what the sign atlas can spell down
the front of the building: capitals, digits and spaces only, short.

`names` are one to three templates its signs are written from, and each one
needs a slot in curly braces: `{family}` for a family name, `{adjective}` for a
word like the ones in the town's story, `{noun}` for a thing. What is not a
slot is written on the sign as it stands, so the trade word goes there when
such places state their trade. A template with no slot puts the same sign over
every door of this kind.

`rumours` are what people in town say about such places, as they would say it,
each one a thing said out loud. Leave the list empty and its people say what
everybody in town knows instead.

## Placement

`share` is its weight in the mix, 1 for rare to 10 for everywhere. `prominence`
is how the map treats it: `background` for a building nobody points at,
`notable` for one people give directions by, `landmark` for the one the town is
known for. `residential` is whether people live in it.

`size.storeys` is the low and the high the building stands, and `size.sprawl`
how much of a plot it wants: `narrow`, `wide`, or a whole `block`.

## The street face

`street.frontage` is what the ground floor meets the pavement with: `masonry`
or `painted` walls with windows, a `shopfront` of glass, a `curtain` wall of
glass all the way up, an `industrial` face of shutters, or `blank`, a wall with
nothing in it. `openness` is how often a window comes round upstairs: `dense`
every module, `even` every second, `sparse` every third. `material` is what
the building reads as made of. `voice` is how loud the sign is: `quiet`,
`sober`, `trade` or `loud`.

## What goes on inside

`access` is who gets past the front door: `open` to anybody, `admitted` as far
as the front room only, `private` for nobody without a key. `service` is the
post at the front, with somebody always on it: `counter`, `desk`, `stalls`, or
`none`. `work` is what else people do in here, up to three: `desk`, `bench`,
`cook`, `floor`, `watch`. `holding` is the classes of thing lying about, up to
three. `finish` is the language the rooms are dressed in.

## Rooms

`rooms.main` is the room the front door leads to, with `hall` before it when
such places have one, and `services` the rooms behind, up to five, each with a
`weight` for how much of the floor it takes, `spare` when a small building may
go without it, and `shut` when its door is locked. Every room's `use` names
the one routine that dresses it, so pick the use whose furniture is the
furniture such a room has: a `ward` is beds along the walls, an `assembly` is
seats in ranks facing a front, a `desk-floor` is desks, a `bench-floor` is
benches, a `bulk-store` is crates, a `store` is shelves, a `taproom` is a bar
counter with stools. `name` is what the room is called on the door.

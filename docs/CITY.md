# The city, and what its size means

Status: decided 2026-08-25, from the owner's own words in `docs/REQUIREMENTS.md`.
Supersedes the scaling assumptions in `docs/PLACES.md` section 6 (the plot mix)
and everything that reads a count off the number of plots.

## 1. The decision

**A city's size is scenery. Everything a player meets is an absolute number.**

Today a ten-block city opens 24 doors, stations 70 people, rolls 157 subway
entrances at twenty blocks, and every one of those is a share of the plot count.
That makes a big city expensive to generate, heavy to send to somebody, and
forgettable to play: 24 places each get one errand and none of them stick.

From now on:

| | |
|---|---|
| open places | **3**, whatever the city's size (the creation form may raise it) |
| people in the file | about **a dozen**, all of them in those places |
| stations | one every **ten blocks**, about 500 m |
| districts | a handful, named, whatever the history says |
| everything else | frontage: a sign, a wall, lit windows, no interior, no people |

A hundred-block city is then three doors, a dozen people, ten stations and a very
large amount of scenery, and it costs about what a two-block city costs.

Three places used by every quest are learned by name. Twenty-four are addresses.

## 2. What the history decides

The first call already writes the town's story and the kinds of place it has. It
gains a **roster**, in the same forced tool call, checked against the same
schema:

- the **districts**: a handful, each a name and a couple of words of character
  ("West Bay, the wharf end, half of it empty since the freight went")
- the **places**: exactly what opens, by kind, with how many people in each, and
  which district each belongs to
- the **relations** that matter: two places that should be far apart, one that
  should sit on the main street

The engine still owns every metre. The roster says a bar, a corporate office and
a police station, twelve people, the bar in West Bay and the office downtown; the
engine decides which plot, which cell, which door, and where the body stands.
The model never sees a coordinate.

## 3. Districts

The unit between the city and a plot, and what makes a large city legible.

- The map labels districts, because two thousand buildings cannot be labelled.
- The guide says "head west into Kiln Bay" instead of a bearing.
- The station picker lists names, not numbers.
- A stranger has a context in one line: who they are is mostly where they are from.
- The look can change as you cross the city: facades are already picked by tag, so
  a corporate district draws glass and the wharf draws low brick with no new art.

Every plot belongs to the district it stands in. The three real places sit in the
districts the history chose for them.

## 4. The streets

The grid stays the navmesh. What changes is that it stops looking like graph
paper.

- **Blocks of different sizes.** The spacing between street lines varies, so no
  two blocks are the same square.
- **Double blocks.** A street line is skipped here and there and two blocks
  become one long one.
- **Streets that stop.** A line that does not run the whole way, giving dead ends
  and T junctions.
- **A staircase avenue.** One street steps across the grid two metres at a time,
  reading as a diagonal at eye level. The plots along it are cut short, which is
  what it costs.

True off-grid diagonals are not in this design: the grid is the navmesh, plots
are cell rectangles and cars drive cell lanes.

## 5. Strangers

Every person in a world file today is stationed inside a building, and the crowd
on the street is those same people sent out of their posts. With three places
that leaves an empty city, so street people become their own thing.

- **Made when you meet them**, never stored in the city file.
- **The same for everybody**: a stranger is derived from the city seed and their
  slot, so two people walking the same city meet the same person on the same
  corner. Determinism holds without storing anyone.
- **A template plus context**: the district they are from, the hour, the weather,
  where they are going, a name and a few lines of life. One shape, filled per
  person.
- **Real once you speak to them.** The moment a conversation opens they are
  written into the playthrough, not the city file, so their name and what passed
  between you survives. Everyone you never spoke to costs nothing.

## 6. A pack

A pack takes the matrix as it is.

- **It opens a door that was painted on.** A facade becomes a real place, with
  its people and its quests. The city's shape does not change, so anybody who
  played the original recognises every street.
- **Or it adds blocks at the edge**, with places in them, for a larger pack.
- **Or it adds quests over the places that already exist**, which is the simplest
  kind and always works.

## 7. What each box does

- **`world`**: the roster and the districts on the document; `district(plotId)`;
  the station rule as a distance rather than a share. Strangers are not world
  data and never enter the file.
- **`forge`**: builds the roster instead of rolling a mix; assigns plots to
  districts; spaces stations by distance; lays irregular bands, double blocks,
  dead ends and the staircase avenue; writes quests over three places and the
  street.
- **`scribe`**: asks for the roster and the districts in the history call, and
  spends the whole per-place budget on three places instead of twenty-four.
- **`talk`**: a stranger's template, filled from district, hour and errand.
- **`play`**: keeps a stranger once spoken to.
- **`crowd`**: walkers are strangers, not residents sent out.
- **`hud`**: district names on the map, in the guide, in the station picker.
- **`prefab`**: looks chosen per district.
- **`bundle`, `cli`**: a pack that opens a facade.

## 8. What this removes

The plot mix as the source of counts, the 14% share, the station share, the
narrator's per-place budget spread thin, and most of a world file. A city stops
being expensive because it is big.

## 9. The instance is another dimension (2026-08-26, his correction)

A slot carries no size and no proportion to the city. It is a door you click,
and behind it the instance is its own space: a small square on the street may
open into a large building with as many rooms as the place needs. The instance
is isolated from the city the way another part of a game is, and the loading
between them is a real loading screen going in and coming out. Whether an
interior is ever held to the footprint of the building it sits behind is a later
question and may never be worth answering.

Distance is not a problem either. A quest that sends a player across town is
entertaining rather than broken: they see the city and they use the subway. The
quest writer is told the district each slot is in and nothing finer, because
coordinates and metres would make it careful about geography and careless about
the story, which is the opposite of what it is for.

What each stage is given is therefore the least that lets it do its own job
well: the architect gets a style and nothing else, the story gets a count of
slots and their districts, the instance builder gets what its place is, who is
inside it and what is in it, and inside that it is free.

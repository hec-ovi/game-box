import { FACINGS, METRICS, SHIPPED_CHARTERS, type Facing, type Plot, type ResolvedCharter } from '@gb/world'
import { heightOf } from '../src/bucket.ts'
import type { Catalogue, ModelSpec } from '../src/catalogue.ts'
import type { BuildingSize } from '../src/dressing.ts'

/**
 * The street a seated fixture is read over: the pack itself.
 *
 * Where a fixture lands is arithmetic on two sides. One is the model the plot
 * is drawn with, which decides where the entrance, the fascia band and every
 * proud face really are; the other is the kind of place the plot stands under,
 * which is what decides how much signage the kit writes for it and of what
 * kind. So the town is those two crossed: every model in the pack on a plot cut
 * to its own shape, standing under the fourteen kinds `@gb/world` ships, in
 * turn, with its door on each of the four walls in turn.
 *
 * A generated town cannot answer for this. The architecture stage raises every
 * building under one word, so a plan is one voice repeated and the signage on
 * it is a nameplate and two door lamps: no blade on a flank, nothing hung out
 * over the street, no lit box on a station's doorstep. Those are the fixtures
 * the seating exists for, and a kind of place is what puts them on a wall.
 *
 * Every plot here is one a city can hold: its footprint is a shape the pack was
 * baked for and so a shape `PLOT_BAND` cuts, its kind is one of the city's own
 * charters, and its `design` is the pin whoever holds the world and the
 * catalogue writes into the file.
 */

/** One building of the street: the plot, what it is drawn at, and the kind of place it stands under. */
export interface Site {
  readonly plot: Plot
  readonly size: BuildingSize
  readonly charter: ResolvedCharter
  readonly model: ModelSpec
}

/** Where the footprint is cut. Only its shape matters, so every plot is cut at the same corner. */
const CORNER = { x: 4, y: 4 } as const

/** One door in this many opens, which is what puts the lit entrance under a seated lamp. */
const OPENS = 8

/** Every model in the pack, on its own plot, under the kinds of place a city ships. */
export function packTown(catalogue: Catalogue): Site[] {
  return catalogue.models.map((model, at) => siteOf(catalogue, model, at))
}

function siteOf(catalogue: Catalogue, model: ModelSpec, at: number): Site {
  const charter = SHIPPED_CHARTERS[at % SHIPPED_CHARTERS.length]!
  // the facing turns over once the charters have been dealt round, so every
  // kind of place is seen on all four walls rather than on the same two
  const facing = FACINGS[Math.floor(at / SHIPPED_CHARTERS.length) % FACINGS.length]!
  const cell = METRICS.cellSize
  const acrossX = facing === 'north' || facing === 'south'
  const frontage = model.front / cell
  const rect = { ...CORNER, w: acrossX ? frontage : model.depth / cell, h: acrossX ? model.depth / cell : frontage }
  const plot: Plot = {
    id: `plot_${String(at + 1).padStart(4, '0')}`,
    kind: charter.word,
    // the architecture's own placeholder: nothing here is an author, and all a
    // plot's name does to a fixture is decide how wide its plate is
    name: `Instance ${at + 1}`,
    rect,
    storeys: model.storeys,
    entrance: { cell: doorstep(rect, facing, at % frontage), facing },
    style: `neon-${charter.word}`,
    design: { pack: catalogue.pack, model: model.id, mirror: at % 2 === 1, rooms: 0 },
    ...(at % OPENS === 0 ? { interiorId: `interior_${String(at + 1).padStart(4, '0')}` } : {}),
  }
  return { plot, model, charter, size: { width: rect.w * cell, depth: rect.h * cell, height: heightOf(model.storeys) } }
}

/**
 * The pavement cell the door opens onto: outside the footprint on the wall it
 * faces, `along` cells from that wall's near corner. It moves along the front
 * from plot to plot because it does in a city, and because the kit writes its
 * door there while the pack centres its own on the front, which is the gap a
 * seated lamp closes.
 */
function doorstep(rect: { x: number; y: number; w: number; h: number }, facing: Facing, along: number): { x: number; y: number } {
  switch (facing) {
    case 'north':
      return { x: rect.x + along, y: rect.y - 1 }
    case 'south':
      return { x: rect.x + along, y: rect.y + rect.h }
    case 'east':
      return { x: rect.x + rect.w, y: rect.y + along }
    case 'west':
      return { x: rect.x - 1, y: rect.y + along }
  }
}

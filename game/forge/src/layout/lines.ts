import type { World } from '@gb/world'
import { BANDS, lineAt, type BandKind, type StreetLine } from './bands.ts'

/** The street bands of a standing town, across and down. */
export interface StreetLines {
  readonly columns: readonly StreetLine[]
  readonly rows: readonly StreetLine[]
}

/**
 * The bands a town was laid in, read back off the road graph it carries.
 * Every segment that is not a road out runs down one band's centreline and
 * says what class the band is, so a town with no plan to hand (one being
 * extended, or one opened from a file) still knows where its streets are and
 * how wide each one is.
 */
export function streetLines(world: World): StreetLines {
  const { nodes, segments } = world.toJSON().roads
  const cellOf = new Map(nodes.map((node) => [node.id, node.cell]))
  const columns = new Map<number, BandKind>()
  const rows = new Map<number, BandKind>()
  for (const segment of segments) {
    if (segment.kind === 'exit') continue
    const from = cellOf.get(segment.from)!
    const to = cellOf.get(segment.to)!
    if (from.x === to.x) columns.set(from.x, segment.kind)
    else rows.set(from.y, segment.kind)
  }
  return { columns: lines(columns), rows: lines(rows) }
}

/** Bands from their centrelines, in order across the map. */
function lines(centres: ReadonlyMap<number, BandKind>): StreetLine[] {
  return [...centres]
    .map(([centre, kind]) => lineAt(centre - BANDS[kind].centreline, kind))
    .sort((a, b) => a.start - b.start)
}

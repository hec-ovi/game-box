/** Draws generated interiors as ASCII floor plans, one per building kind. */
import { BUILDING_KINDS, type Interior, type World } from '@gb/world'
import { Forge, OfflineNarrator } from '../src/index.ts'
import { footprintOf } from '../src/interior/props.ts'

const CELL = 0.4

const GLYPHS: Record<string, string> = {
  'bar-counter': 'H',
  'bar-stool': 'o',
  table: 'T',
  chair: 'c',
  sofa: 'U',
  bed: 'B',
  desk: 'D',
  'office-chair': 'q',
  shelf: 'S',
  cabinet: 'A',
  wardrobe: 'W',
  fridge: 'F',
  stove: 'V',
  sink: 'N',
  counter: '=',
  register: 'R',
  'display-case': 'G',
  'crate-stack': 'X',
  plant: 'P',
  lamp: 'l',
  rug: '~',
  tv: 'Y',
  'coffee-machine': 'K',
  jukebox: 'J',
}

const seed = process.argv[2] ?? 'floorplan'
const forge = new Forge(new OfflineNarrator(seed))
const built = await forge.build({ theme: 'dusty western mining town', seed, blocksX: 3, blocksY: 3, blockCells: 14 })
if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 500))
const world = built.value.world

for (const kind of BUILDING_KINDS) {
  const plot = world.plotsOfKind(kind)[0]
  if (!plot) continue
  const interior = world.interiors().find((i) => i.plotId === plot.id)
  if (interior) draw(world, interior)
}

function draw(world: World, interior: Interior): void {
  const plot = world.plot(interior.plotId)!
  const cols = Math.ceil(interior.size.w / CELL)
  const rows = Math.ceil(interior.size.h / CELL)
  const canvas = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '))

  for (const room of interior.rooms) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = (x + 0.5) * CELL
        const py = (y + 0.5) * CELL
        const inside = px >= room.rect.x && px <= room.rect.x + room.rect.w && py >= room.rect.y && py <= room.rect.y + room.rect.h
        if (!inside) continue
        const edge =
          px - room.rect.x < CELL || room.rect.x + room.rect.w - px < CELL || py - room.rect.y < CELL || room.rect.y + room.rect.h - py < CELL
        canvas[y]![x] = edge ? '#' : '.'
      }
    }
  }

  for (const piece of interior.furniture) {
    const box = footprintOf(piece)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = (x + 0.5) * CELL
        const py = (y + 0.5) * CELL
        if (px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h) canvas[y]![x] = GLYPHS[piece.prop] ?? '?'
      }
    }
  }

  for (const anchor of interior.anchors) mark(canvas, anchor.pos, '@', cols, rows)
  for (const door of interior.doors) mark(canvas, door.pos, '+', cols, rows)

  const people = world.npcsIn(plot.id).map((n) => `${n.name} (${n.role})`)
  console.log(`\n${plot.kind}: ${plot.name}  ${interior.size.w.toFixed(1)}x${interior.size.h.toFixed(1)}m  door faces ${plot.entrance.facing}`)
  console.log(`  rooms: ${interior.rooms.map((r) => `${r.name} ${r.rect.w.toFixed(1)}x${r.rect.h.toFixed(1)}`).join(' | ')}`)
  console.log(`  ${interior.furniture.length} pieces, ${interior.anchors.length} anchors: ${interior.anchors.map((a) => a.kind).join(',')}`)
  if (people.length) console.log(`  ${people.join(', ')}`)
  for (const row of canvas) console.log('  ' + row.join(''))
}

function mark(canvas: string[][], pos: { x: number; y: number }, glyph: string, cols: number, rows: number): void {
  const x = Math.min(cols - 1, Math.max(0, Math.floor(pos.x / CELL)))
  const y = Math.min(rows - 1, Math.max(0, Math.floor(pos.y / CELL)))
  canvas[y]![x] = glyph
}

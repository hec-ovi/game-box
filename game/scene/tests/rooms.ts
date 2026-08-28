import { footprintOf, PROP_SPECS, type Anchor, type Facing, type Furniture, type FurnitureProp, type Interior, type Item, type Plot, type World } from '@gb/world'

/**
 * Rooms behind the doors of a planned town.
 *
 * A plan is the arithmetic half of a city: it lays every street and every
 * building out and stops before a word is written, so nothing stands behind
 * any of its doors. The builders in this box are measured against rooms, so
 * this cuts one or two out of a plot's own footprint, stands furniture round
 * their walls and leaves a thing or two on it, straight into `@gb/world`'s
 * records.
 *
 * It is a floor plan and nothing else. No place is called anything, nobody is
 * standing in it, and what a thing is called here is the shape it is.
 */

type Room = Interior['rooms'][number]
type Door = Interior['doors'][number]
type Rect = Room['rect']
type Point = Door['pos']

/** Metres of clear floor kept round a doorway, so nothing stands in the way through it. */
const DOORWAY = 2

/** How far off the wall a piece stands, and how far along the wall to the next one. */
const INSET = 1
const APART = 2

/** How far in front of a piece the body using it stands. */
const REACH = 0.45

/** The smallest room worth cutting, and the shallowest building worth cutting in two. */
const SMALLEST = 6
const SPLIT = 8

/** What goes round the walls of a room, in the order the slots take them. None is wider than the gap between two slots. */
const PIECES: readonly FurnitureProp[] = ['counter', 'table', 'chair', 'shelf', 'plant', 'cabinet', 'display-case']

/** What is left lying about: one on the first piece with a surface, one on the bare floor. */
const THINGS = [
  { archetype: 'cup', name: 'Cup', description: 'a cup' },
  { archetype: 'bottle', name: 'Bottle', description: 'a bottle' },
] as const

/** Compass degrees for each wall a front door stands in, the way the world writes a heading. */
const DEGREES: Record<Facing, number> = { north: 0, east: 90, south: 180, west: 270 }

/** Where something stands on the floor and which way it looks. */
interface Slot extends Point {
  readonly rot: number
}

/** Where a compass heading points across the floor. */
function towards(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

/**
 * Opens the first `count` plots of a town big enough to hold a room. Every
 * other building is left as the frontage the plan laid, which is what most of
 * a city is.
 */
export function openRooms(world: World, count: number): void {
  let opened = 0
  for (const plot of world.plots()) {
    if (opened >= count) return
    if (openRoom(world, plot)) opened++
  }
}

/** The rooms behind that plot's door, furnished. False when the plot is too small to hold any. */
function openRoom(world: World, plot: Plot): boolean {
  const size = { w: plot.rect.w * world.cellSize, h: plot.rect.h * world.cellSize }
  if (size.w < SMALLEST || size.h < SMALLEST) return false

  const cut = cutInto(size, plot.entrance.facing)
  const rooms: Room[] = cut.rects.map((rect, at) => ({ id: world.mintId('room'), kind: at === 0 ? 'main' : 'backroom', name: 'Room', rect }))
  const doors: Door[] = [{ id: world.mintId('door'), from: 'outside', to: rooms[0]!.id, pos: cut.street, rot: cut.street.rot, locked: false }]
  const back = rooms[1]
  if (cut.between && back) {
    doors.push({ id: world.mintId('door'), from: rooms[0]!.id, to: back.id, pos: cut.between, rot: cut.between.rot, locked: false })
  }

  const openings = doors.map((door) => door.pos)
  const furniture: Furniture[] = []
  const anchors: Anchor[] = []
  for (const room of rooms) {
    const filled = fillOut(world, room, openings)
    furniture.push(...filled.furniture)
    anchors.push(...filled.anchors)
  }
  // and one spot in the open, so a place has somewhere to stand with nothing to stand a thing on
  anchors.push({ id: world.mintId('anchor'), kind: 'stand', roomId: rooms[0]!.id, pos: middleOf(rooms[0]!.rect), rot: cut.street.rot })

  const interior = world.addInterior({ id: world.mintId('interior'), plotId: plot.id, kind: plot.kind, size, rooms, doors, furniture, anchors })
  if (!interior.ok) throw new Error(`no room behind ${plot.id}: ${interior.error.code}`)

  leaveThings(world, interior.value.id, anchors)
  return true
}

/**
 * The floor cut into rooms: the one the street door opens onto, and the one
 * behind it where the building is deep enough for two. The cut runs parallel
 * to the wall the door stands in, so the back room is the far half.
 */
function cutInto(size: { w: number; h: number }, facing: Facing): { rects: Rect[]; street: Slot; between?: Slot } {
  const out = towards(DEGREES[facing])
  const across = out.x !== 0
  const street = { x: size.w / 2 + (out.x * size.w) / 2, y: size.h / 2 + (out.y * size.h) / 2, rot: DEGREES[facing] }
  const depth = across ? size.w : size.h
  if (depth < SPLIT) return { rects: [{ x: 0, y: 0, ...size }], street }

  // the half the door stands in comes first: the street opens onto it
  const half = depth / 2
  const near = out.x > 0 || out.y > 0 ? half : 0
  const halves = [near, half - near].map((from) => (across ? { x: from, y: 0, w: half, h: size.h } : { x: 0, y: from, w: size.w, h: half }))
  return { rects: halves, street, between: { x: across ? half : size.w / 2, y: across ? size.h / 2 : half, rot: across ? 90 : 0 } }
}

/** Furniture round the walls of one room, with somewhere to stand at everything a body meets. */
function fillOut(world: World, room: Room, openings: readonly Point[]): { furniture: Furniture[]; anchors: Anchor[] } {
  const furniture: Furniture[] = []
  const anchors: Anchor[] = []
  let worktop: { piece: Furniture; top: number } | undefined

  for (const [index, slot] of slotsIn(room.rect, openings).slice(0, PIECES.length).entries()) {
    const prop = PIECES[index]!
    const piece: Furniture = { id: world.mintId('prop'), prop, roomId: room.id, pos: { x: slot.x, y: slot.y }, rot: slot.rot }
    furniture.push(piece)

    // a piece a body meets gets the spot that body stands on, in front of it
    // and looking back at it, which is where a thing left there comes to rest
    const contact = PROP_SPECS[prop].contact
    if (!contact) continue
    if (!worktop && contact.kind === 'work') worktop = { piece, top: contact.height }
    const front = towards(slot.rot)
    const away = footprintOf(prop).depth / 2 + REACH
    anchors.push({
      id: world.mintId('anchor'),
      kind: contact.kind === 'rest' ? 'sit' : 'serve',
      roomId: room.id,
      pos: { x: slot.x + front.x * away, y: slot.y + front.y * away },
      rot: (slot.rot + 180) % 360,
      propId: piece.id,
    })
  }

  // a till stands on the counter rather than on the floor, which is the one
  // piece in a room drawn at a height another piece decided
  if (worktop) {
    const { piece, top } = worktop
    furniture.push({ id: world.mintId('prop'), prop: 'register', roomId: room.id, pos: piece.pos, rot: piece.rot, lift: top, on: piece.id })
  }
  return { furniture, anchors }
}

/**
 * Every place round the walls of a room a piece can stand: a step off each
 * wall, a couple of metres apart, clear of every way in and out. The furthest
 * from the street door comes first, so what a room is about stands at the back
 * of it.
 */
function slotsIn(rect: Rect, openings: readonly Point[]): Slot[] {
  const walls = [
    { rot: 180, at: rect.y + INSET, from: rect.x, span: rect.w, across: false },
    { rot: 0, at: rect.y + rect.h - INSET, from: rect.x, span: rect.w, across: false },
    { rot: 90, at: rect.x + INSET, from: rect.y, span: rect.h, across: true },
    { rot: 270, at: rect.x + rect.w - INSET, from: rect.y, span: rect.h, across: true },
  ]

  const found = new Map<string, Slot>()
  for (const wall of walls) {
    for (let step = wall.from + INSET; step <= wall.from + wall.span - INSET; step += APART) {
      const slot = { x: wall.across ? wall.at : step, y: wall.across ? step : wall.at, rot: wall.rot }
      if (openings.some((door) => Math.hypot(slot.x - door.x, slot.y - door.y) < DOORWAY)) continue
      found.set(`${slot.x},${slot.y}`, slot)
    }
  }

  const way = openings[0] ?? middleOf(rect)
  return [...found.values()].sort((one, two) => {
    const apart = Math.hypot(two.x - way.x, two.y - way.y) - Math.hypot(one.x - way.x, one.y - way.y)
    return apart !== 0 ? apart : one.x - two.x || one.y - two.y
  })
}

/** A thing left at the first spot with furniture behind it, and another on the bare floor. */
function leaveThings(world: World, interiorId: string, anchors: readonly Anchor[]): void {
  const spots = [anchors.find((one) => one.propId), anchors.find((one) => !one.propId)]
  for (const [index, anchor] of spots.entries()) {
    if (!anchor) continue
    const item: Item = { id: world.mintId('item'), ...THINGS[index]!, value: 1, bulk: 'pocket' }
    const left = world.addItem(item, { at: 'anchor', itemId: item.id, interiorId, anchorId: anchor.id })
    if (!left.ok) throw new Error(`nothing could be left in ${interiorId}: ${left.error.code}`)
  }
}

function middleOf(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

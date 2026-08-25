import type { Built, Course, Frontage, KitPiece, Openness } from '@gb/world'

/**
 * The wall courses a frontage is built from, in `@gb/world`'s `KIT_PIECES`.
 * A charter names a frontage and an openness; this is the one table that turns
 * those into piece ids, so no generator ever writes one.
 */

/** The upper window rhythm each openness means: every module, every second, every third. */
const RHYTHM: Record<Openness, Course['rhythm']> = { dense: 1, even: 2, sparse: 3 }

interface Elevation {
  readonly street: Course
  readonly flank: Course
  readonly upper: Omit<Course, 'rhythm'>
  readonly crown?: KitPiece
  readonly fascia: KitPiece
  readonly door: KitPiece
}

const BRICK: Course = { plain: 'Brick_BottomTrim', window: 'Brick_Window_Trim', rhythm: 2 }
const TRIM: Course = { plain: 'Trim_FirstFloor_Wall', window: 'Trim_FirstFloor_Window_001', rhythm: 1 }
const SHOP: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 1 }
const GLASS: Course = { plain: 'Metal_Plain_3', window: 'Metal_FullWindow', rhythm: 1 }
const SHED: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 3 }
/** A windowless wall: the window piece is the plain one. */
const WALL: Course = { plain: 'Brick_BottomTrim', window: 'Brick_BottomTrim', rhythm: 1 }

const BRICK_UPPER = { plain: 'Brick_Plain_3', window: 'Brick_Window_Trim_Single' } as const
const METAL_UPPER = { plain: 'Metal_Plain_3', window: 'Metal_Window_Half' } as const

const ELEVATIONS: Record<Frontage, Elevation> = {
  masonry: { street: BRICK, flank: BRICK, upper: { plain: 'Brick_Plain_3', window: 'Brick_Window_Square_Single' }, crown: 'Brick_TopTrim', fascia: 'Brick_Plain_1', door: 'DoorFrame_Trim' },
  painted: { street: TRIM, flank: BRICK, upper: BRICK_UPPER, crown: 'Brick_TopTrim', fascia: 'Metal_FirstFloor_Wall_1', door: 'DoorFrame_Trim' },
  shopfront: { street: SHOP, flank: BRICK, upper: BRICK_UPPER, crown: 'Brick_TopTrim', fascia: 'Metal_FirstFloor_Wall_1', door: 'DoorFrame_Metal_Single' },
  curtain: { street: GLASS, flank: GLASS, upper: METAL_UPPER, fascia: 'Metal_Plain_1', door: 'DoorFrame_Metal_Single' },
  industrial: { street: SHED, flank: SHED, upper: METAL_UPPER, fascia: 'Metal_FirstFloor_Wall_1', door: 'DoorFrame_Metal_Single' },
  blank: { street: WALL, flank: WALL, upper: { plain: 'Brick_Plain_3', window: 'Brick_Plain_3' }, crown: 'Brick_TopTrim', fascia: 'Brick_Plain_1', door: 'DoorFrame_Trim' },
}

/** What the kit builds for a frontage: its courses, the upper storeys at the openness the charter asks for. */
export function builtFor(frontage: Frontage, openness: Openness): Built {
  const { street, flank, upper, crown, fascia, door } = ELEVATIONS[frontage]
  return {
    street: { ...street },
    flank: { ...flank },
    upper: { ...upper, rhythm: RHYTHM[openness] },
    ...(crown ? { crown } : {}),
    fascia,
    door,
  }
}

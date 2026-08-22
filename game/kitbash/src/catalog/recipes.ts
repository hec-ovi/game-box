import type { BuildingKind } from '@gb/world'
import type { PieceId } from './pieces.ts'

/** One wall treatment: what a plain module is, what a windowed one is, how often a window comes round. */
export interface Course {
  readonly plain: PieceId
  readonly window: PieceId
  /** A window every N modules. 1 is a continuous shopfront, 3 is a warehouse. */
  readonly rhythm: 1 | 2 | 3
}

export interface Recipe {
  /** Street level on the face the door is on. */
  readonly street: Course
  /** Street level on the other three faces: a shopfront only faces the street. */
  readonly flank: Course
  /** Everything above the first floor. */
  readonly upper: Course
  /** Replaces `upper.plain` on the topmost band, carrying the crowning course. */
  readonly crown?: PieceId
  /** The metre-tall band that closes the 4 m ground floor over a 3 m module. */
  readonly fascia: PieceId
  readonly door: PieceId
}

const MASONRY: Course = { plain: 'Brick_BottomTrim', window: 'Brick_Window_Trim', rhythm: 2 }
const GLAZED: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 1 }
const PAINTED: Course = { plain: 'Trim_FirstFloor_Wall', window: 'Trim_FirstFloor_Window_001', rhythm: 1 }
const CURTAIN: Course = { plain: 'Metal_Plain_3', window: 'Metal_FullWindow', rhythm: 1 }
const INDUSTRIAL: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 3 }

const brick = (rhythm: 1 | 2 | 3, window: PieceId = 'Brick_Window_Trim_Single'): Course => ({ plain: 'Brick_Plain_3', window, rhythm })
const metal = (rhythm: 1 | 2 | 3): Course => ({ plain: 'Metal_Plain_3', window: 'Metal_Window_Half', rhythm })

/** Brick above, whatever the trade wants at street level, a crowning course on top. */
const masonry = (street: Course, upper: Course, door: PieceId, fascia: PieceId): Recipe =>
  ({ street, flank: MASONRY, upper, crown: 'Brick_TopTrim', fascia, door })

/** Metal and glass all the way up: no crowning course, because a curtain wall has none. */
const framed = (street: Course, upper: Course, flank: Course, fascia: PieceId): Recipe =>
  ({ street, flank, upper, fascia, door: 'DoorFrame_Metal_Single' })

/**
 * What each kind of place is made of. A shop is a shopfront under brick, an
 * office is glass all the way up, a warehouse is a metal shed with a window
 * every third module.
 */
export const RECIPES: Record<BuildingKind, Recipe> = {
  house: masonry(MASONRY, brick(2, 'Brick_Window_Square_Single'), 'DoorFrame_Trim', 'Brick_Plain_1'),
  apartment: masonry(MASONRY, brick(1, 'Brick_Window_Square_Single'), 'DoorFrame_Trim', 'Brick_Plain_1'),
  chapel: masonry(MASONRY, brick(3), 'DoorFrame_Trim', 'Brick_Plain_1'),
  bar: masonry(PAINTED, brick(2), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  cafe: masonry(PAINTED, brick(2), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  restaurant: masonry(PAINTED, brick(2), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  clinic: masonry(PAINTED, brick(1), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  hotel: masonry(PAINTED, brick(1), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  shop: masonry(GLAZED, brick(1), 'DoorFrame_Metal_Single', 'Metal_FirstFloor_Wall_1'),
  market: masonry(GLAZED, brick(2), 'DoorFrame_Metal_Single', 'Metal_FirstFloor_Wall_1'),
  office: framed(CURTAIN, metal(1), CURTAIN, 'Metal_Plain_1'),
  station: framed(CURTAIN, metal(1), CURTAIN, 'Metal_Plain_1'),
  workshop: framed(INDUSTRIAL, metal(3), INDUSTRIAL, 'Metal_FirstFloor_Wall_1'),
  warehouse: framed(INDUSTRIAL, metal(3), INDUSTRIAL, 'Metal_FirstFloor_Wall_1'),
}

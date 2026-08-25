import type { Frontage, Openness } from '@gb/world'
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

type Rhythm = Course['rhythm']

const MASONRY: Course = { plain: 'Brick_BottomTrim', window: 'Brick_Window_Trim', rhythm: 2 }
const GLAZED: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 1 }
const PAINTED: Course = { plain: 'Trim_FirstFloor_Wall', window: 'Trim_FirstFloor_Window_001', rhythm: 1 }
const CURTAIN: Course = { plain: 'Metal_Plain_3', window: 'Metal_FullWindow', rhythm: 1 }
const INDUSTRIAL: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 3 }
/** A windowless brick wall: the window slot holds the wall piece, so nothing on it ever glazes. */
const BLANK: Course = { plain: 'Brick_BottomTrim', window: 'Brick_BottomTrim', rhythm: 3 }

const brick = (rhythm: Rhythm, window: PieceId = 'Brick_Window_Trim_Single'): Course => ({ plain: 'Brick_Plain_3', window, rhythm })
const metal = (rhythm: Rhythm): Course => ({ plain: 'Metal_Plain_3', window: 'Metal_Window_Half', rhythm })

/** Brick above, whatever the trade wants at street level, a crowning course on top. */
const masonry = (street: Course, upper: Course, door: PieceId, fascia: PieceId): Recipe =>
  ({ street, flank: MASONRY, upper, crown: 'Brick_TopTrim', fascia, door })

/** Metal and glass all the way up: no crowning course, because a curtain wall has none. */
const framed = (street: Course, upper: Course, flank: Course, fascia: PieceId): Recipe =>
  ({ street, flank, upper, fascia, door: 'DoorFrame_Metal_Single' })

/** The upper window rhythm each openness asks for: dense every module, even every second, sparse every third. */
const RHYTHM: Record<Openness, Rhythm> = { dense: 1, even: 2, sparse: 3 }

/** One frontage at every openness. */
const opened = (row: (rhythm: Rhythm) => Recipe): Record<Openness, Recipe> =>
  ({ dense: row(RHYTHM.dense), even: row(RHYTHM.even), sparse: row(RHYTHM.sparse) })

/**
 * What a front is made of, by how it meets the street and how open its upper
 * storeys are: a shopfront under brick, glass all the way up, a metal shed
 * with a window every third module, or a blank block with no window at all.
 * The world writes the row a charter picks into the file as `built`, so a
 * building is drawn from the file and never from this table.
 */
export const RECIPES: Record<Frontage, Record<Openness, Recipe>> = {
  masonry: opened((rhythm) => masonry(MASONRY, brick(rhythm, 'Brick_Window_Square_Single'), 'DoorFrame_Trim', 'Brick_Plain_1')),
  painted: opened((rhythm) => masonry(PAINTED, brick(rhythm), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1')),
  shopfront: opened((rhythm) => masonry(GLAZED, brick(rhythm), 'DoorFrame_Metal_Single', 'Metal_FirstFloor_Wall_1')),
  curtain: opened((rhythm) => framed(CURTAIN, metal(rhythm), CURTAIN, 'Metal_Plain_1')),
  industrial: opened((rhythm) => framed(INDUSTRIAL, metal(rhythm), INDUSTRIAL, 'Metal_FirstFloor_Wall_1')),
  blank: opened((rhythm) => ({ street: BLANK, flank: BLANK, upper: { plain: 'Brick_Plain_3', window: 'Brick_Plain_3', rhythm }, crown: 'Brick_TopTrim', fascia: 'Brick_Plain_1', door: 'DoorFrame_Trim' })),
}

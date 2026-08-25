import type { Built, Course } from '../../model/resolved.ts'
import type { KitPiece } from '../../model/pieces.ts'

/** The wall treatments the fourteen presets are built from, as the kit builds them. */
export const MASONRY: Course = { plain: 'Brick_BottomTrim', window: 'Brick_Window_Trim', rhythm: 2 }
export const GLAZED: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 1 }
export const PAINTED: Course = { plain: 'Trim_FirstFloor_Wall', window: 'Trim_FirstFloor_Window_001', rhythm: 1 }
export const CURTAIN: Course = { plain: 'Metal_Plain_3', window: 'Metal_FullWindow', rhythm: 1 }
export const INDUSTRIAL: Course = { plain: 'Metal_FirstFloor_Wall', window: 'Metal_FirstFloor_Window', rhythm: 3 }

export const brick = (rhythm: Course['rhythm'], window: KitPiece = 'Brick_Window_Trim_Single'): Course => ({
  plain: 'Brick_Plain_3',
  window,
  rhythm,
})

export const metal = (rhythm: Course['rhythm']): Course => ({ plain: 'Metal_Plain_3', window: 'Metal_Window_Half', rhythm })

/** Brick above, whatever the trade wants at street level, a crowning course on top. */
export const masonry = (street: Course, upper: Course, door: KitPiece, fascia: KitPiece): Built => ({
  street,
  flank: MASONRY,
  upper,
  crown: 'Brick_TopTrim',
  fascia,
  door,
})

/** Metal and glass all the way up: no crowning course, because a curtain wall has none. */
export const framed = (street: Course, upper: Course, flank: Course, fascia: KitPiece): Built => ({
  street,
  flank,
  upper,
  fascia,
  door: 'DoorFrame_Metal_Single',
})

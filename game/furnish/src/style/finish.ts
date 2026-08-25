import type { Finish } from '@gb/world'
import type { FurnishStyle } from './palette.ts'

/**
 * Which interior language a finish is dressed in.
 *
 * The charter says what a place is finished like, and the language follows
 * from that: `domestic` is moulded and warm, and every finish somebody works
 * in is machined and cool. Exhaustive over `FINISHES`, so a new finish has to
 * say which it is before it compiles.
 */
const STYLE: Record<Finish, FurnishStyle> = {
  domestic: 'home',
  civic: 'corpo',
  industrial: 'corpo',
  corporate: 'corpo',
  worn: 'corpo',
}

/** The finish a bare dressing stands in, for an interior that names none. */
const FINISH: Record<FurnishStyle, Finish> = {
  home: 'domestic',
  corpo: 'corporate',
}

export function styleOf(finish: Finish): FurnishStyle {
  return STYLE[finish]
}

export function finishOf(style: FurnishStyle): Finish {
  return FINISH[style]
}

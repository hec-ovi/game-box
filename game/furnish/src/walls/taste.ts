/**
 * How often a wall reaches for each kind of bay.
 *
 * Two tables and nothing else. `BAY_TASTE` is the row a finish draws from:
 * what the charter says a place is finished like decides whether its walls
 * are panelled and lit or bare and racked. `USE_TASTE` is how the room's own
 * use tilts that row: a store leans to shelves, a washroom to grilles, a
 * bedroom to pictures and windows. `tasteOf` is the two multiplied. Retune
 * here, nowhere else.
 */
import type { Finish, RoomUse } from '@gb/world'
import type { BayKind } from './bays.ts'

export type Taste = Readonly<Record<BayKind, number>>

/** One weight per bay kind, per finish. */
export const BAY_TASTE: Record<Finish, Taste> = {
  // flat panel with a machined rhythm, services on show, a lit case rather than a shelf of clutter
  corporate: { plain: 3, panel: 9, niche: 3, shelf: 2, frame: 2, grille: 3, strip: 2, window: 3 },
  // a cabin wall: more things standing on things, warmer and busier
  domestic: { plain: 3, panel: 8, niche: 4, shelf: 4, frame: 3, grille: 1, strip: 2, window: 4 },
  // an institution: bare stretches, notices in frames, little standing on the walls
  civic: { plain: 5, panel: 8, niche: 2, shelf: 1, frame: 3, grille: 3, strip: 2, window: 4 },
  // a place of work: racks and vents, few pictures, the light strips up the wall
  industrial: { plain: 4, panel: 4, niche: 1, shelf: 5, frame: 1, grille: 5, strip: 3, window: 2 },
  // left as it was: mostly bare wall, what is there is unlit
  worn: { plain: 6, panel: 5, niche: 2, shelf: 3, frame: 1, grille: 3, strip: 1, window: 3 },
}

/** How a room's use multiplies its finish's row. A kind left out keeps its weight. */
export const USE_TASTE: Partial<Record<RoomUse, Partial<Record<BayKind, number>>>> = {
  'entrance-hall': { frame: 1.5, panel: 1.2 },
  'waiting-room': { frame: 1.5, panel: 1.2 },
  lobby: { frame: 1.5, niche: 1.5, panel: 1.2 },
  concourse: { window: 1.5, strip: 1.5, panel: 1.2 },
  taproom: { niche: 2, strip: 1.5 },
  'cafe-floor': { frame: 1.5, niche: 1.5 },
  'dining-room': { frame: 2, grille: 0.5 },
  'shop-floor': { shelf: 2, niche: 1.5 },
  'market-hall': { shelf: 1.5, grille: 1.5, frame: 0.5 },
  'desk-floor': { panel: 1.5, strip: 1.5, shelf: 0.5 },
  'private-office': { frame: 2, shelf: 1.5 },
  'bench-floor': { grille: 2, shelf: 1.5, frame: 0.5 },
  ward: { plain: 2, grille: 1.5, shelf: 0.5, frame: 0.5, niche: 0.5 },
  assembly: { panel: 1.5, frame: 1.5, window: 1.5, shelf: 0, grille: 0.5 },
  'living-room': { frame: 1.5, niche: 1.5 },
  bedroom: { frame: 1.5, window: 1.5, grille: 0.5, shelf: 0.5 },
  'guest-room': { frame: 1.5, window: 1.5, grille: 0.5, shelf: 0.5 },
  kitchen: { shelf: 2, grille: 1.5, frame: 0 },
  washroom: { grille: 2, panel: 1.5, shelf: 0, frame: 0, niche: 0.5 },
  store: { shelf: 3, grille: 1.5, frame: 0, niche: 0, window: 0.5, strip: 0.5 },
  'bulk-store': { shelf: 3, grille: 1.5, frame: 0, niche: 0, window: 0.5, strip: 0.5 },
}

/** The row a wall in this finish, in a room of this use, draws its bays from. */
export function tasteOf(finish: Finish, use: RoomUse | undefined): Taste {
  const base = BAY_TASTE[finish]
  const tilt = use === undefined ? undefined : USE_TASTE[use]
  if (!tilt) return base
  const taste = { ...base }
  for (const kind of Object.keys(base) as BayKind[]) taste[kind] = base[kind] * (tilt[kind] ?? 1)
  return taste
}

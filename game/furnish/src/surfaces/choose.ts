/**
 * Which floor, wall and ceiling one interior gets.
 *
 * Every part is drawn from its own stream, forked off the town seed by the
 * interior's id, so the same building is the same room every time and the shop
 * next door is a different one. Retuning the pool for one part cannot move
 * another, and the pools are fixed length, so what a town costs in materials
 * does not move either.
 */
import { Rng } from '@gb/kit'
import type { FurnishStyle } from '../style/palette.ts'
import { SURFACE_LOOKS, SURFACE_PARTS, type SurfacePart } from './surfaces.ts'

export type SurfaceChoices = Record<SurfacePart, number>

/** The first entry of every pool: what a room with no interior behind it gets. */
export const FIRST_CHOICES: SurfaceChoices = { floor: 0, wall: 0, ceiling: 0 }

export function surfaceChoices(seed: string, style: FurnishStyle, interiorId: string): SurfaceChoices {
  const rng = new Rng(seed).fork('furnish').fork('surfaces').fork(style).fork(interiorId)
  const chosen = {} as Record<SurfacePart, number>
  for (const part of SURFACE_PARTS) chosen[part] = rng.fork(part).int(0, SURFACE_LOOKS[style][part].length - 1)
  return chosen
}

import type { Plot } from '@gb/world'
import { planBuilding, type BuildingSize } from './compose/plan.ts'
import type { Sign } from './sign/sign.ts'

/**
 * Every sign a plot would carry, in metres in the building's own frame. The
 * building itself is planned the same way, so what this answers is what will
 * actually be standing on the wall.
 */
export function signsFor(plot: Plot, size: BuildingSize, cellSize = size.width / plot.rect.w): readonly Sign[] {
  return planBuilding(plot, size, cellSize).signs
}

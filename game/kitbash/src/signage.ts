import type { Plot } from '@gb/world'
import type { PlotCharter } from './charter.ts'
import { planBuilding, type BuildingSize } from './compose/plan.ts'
import type { LightEmitter } from './sign/light.ts'
import type { Sign } from './sign/sign.ts'

/**
 * Every sign a plot would carry, in metres in the building's own frame. The
 * building itself is planned the same way, so what this answers is what will
 * actually be standing on the wall.
 */
export function signsFor(plot: Plot, size: BuildingSize, charter: PlotCharter, cellSize = size.width / plot.rect.w): readonly Sign[] {
  return planBuilding(plot, size, cellSize, charter).signs
}

/**
 * Every glazed module above the street, as the patch of wall it covers. It is
 * what the signage was kept off, and it is published so that promise can be
 * checked from outside rather than taken on trust.
 */
export function glazingFor(plot: Plot, size: BuildingSize, charter: PlotCharter, cellSize = size.width / plot.rect.w) {
  return planBuilding(plot, size, cellSize, charter).walls.glazing
}

/** A light for every sign, strip and door lamp the plan puts on that plot, in the same frame. */
export function lightsFor(plot: Plot, size: BuildingSize, charter: PlotCharter, cellSize = size.width / plot.rect.w): readonly LightEmitter[] {
  return planBuilding(plot, size, cellSize, charter).lights
}

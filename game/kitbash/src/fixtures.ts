import type { Plot } from '@gb/world'
import type { PlotCharter } from './charter.ts'
import { planBuilding, type BuildingSize } from './compose/plan.ts'
import type { Fixtures } from './fixture/plan.ts'

/** The subway entrance and the cameras a plot would carry, in metres in the building's own frame: what `building` will draw into its walls. */
export function fixturesFor(plot: Plot, size: BuildingSize, charter: PlotCharter, cellSize = size.width / plot.rect.w): Fixtures {
  return planBuilding(plot, size, cellSize, charter).fixtures
}

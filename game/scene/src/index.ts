/** @gb/scene: turning a world into something you can stand in. See CONTRACT.md. */
export { buildCity, storeyHeight, type CityBuild } from './city.ts'
export { CityBuilding } from './batch/building.ts'
export { plotOf } from './batch/batcher.ts'
export { buildInterior, type InteriorBuild } from './interior.ts'
export { STEP_OVER_HEIGHT } from './blockers.ts'
export { PropFootprint } from './footprint.ts'
export { Greybox, type Dressing } from './dressing.ts'
export { MARKING, type Marking, type MarkingKind, type MarkingPaint } from './markings.ts'

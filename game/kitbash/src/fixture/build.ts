import { cameraShape } from './camera/model.ts'
import type { Fixture } from './fixture.ts'
import type { Fixtures } from './plan.ts'
import { frameOf } from './shape.ts'
import { subwayShape } from './subway/model.ts'

/** The geometry of every fixture a plan carries, in the building's frame, on the kit materials it welds into. */
export function fixtureParts(fixtures: Fixtures): Fixture[] {
  const parts: Fixture[] = []
  if (fixtures.subway) parts.push(...subwayShape(fixtures.subway.cellSize).build(frameOf(fixtures.subway.position, fixtures.subway.rotationY)))
  for (const camera of fixtures.cameras) parts.push(...cameraShape().build(frameOf(camera.position, camera.rotationY)))
  return parts
}

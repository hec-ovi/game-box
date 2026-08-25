import { World, type InteriorInput, type WorldError } from '../src/index.ts'
import type { Result } from '@gb/kit'

/**
 * A house with a front room and a back room behind an inner door, on a
 * pavement, in a city built from the presets. The interior is handed back
 * as an input, so a test can lock a door or put a machine in before adding it.
 */
export function house() {
  const world = World.create({ name: 'Hollis', theme: 'plain', seed: 'house', width: 16, height: 16 })
  world.paint({ x: 0, y: 5, w: 16, h: 1 }, 'sidewalk')
  const plot = world.addPlot({
    kind: 'house',
    name: 'Hollis Place',
    rect: { x: 2, y: 1, w: 4, h: 4 },
    entrance: { cell: { x: 3, y: 5 }, facing: 'south' },
    storeys: 1,
    style: 'timber',
  })
  if (!plot.ok) throw new Error(JSON.stringify(plot.error))
  const front = world.mintId('room')
  const back = world.mintId('room')
  const street = world.mintId('door')
  const inner = world.mintId('door')
  const interior: InteriorInput = {
    id: world.mintId('interior'),
    plotId: plot.value.id,
    kind: 'house',
    size: { w: 8, h: 8 },
    rooms: [
      { id: front, kind: 'main', name: 'Front room', rect: { x: 0, y: 0, w: 8, h: 4 } },
      { id: back, kind: 'office', name: 'Study', rect: { x: 0, y: 4, w: 8, h: 4 } },
    ],
    doors: [
      { id: street, from: 'outside', to: front, pos: { x: 4, y: 0 }, rot: 180 },
      { id: inner, from: front, to: back, pos: { x: 4, y: 4 }, rot: 0 },
    ],
    furniture: [],
    anchors: [],
  }
  return { world, plot: plot.value, interior, rooms: { front, back }, doors: { street, inner } }
}

export function unwrap<T>(result: Result<T, WorldError>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

export function violationsOf(result: Result<unknown, WorldError>): string[] {
  if (result.ok || result.error.code !== 'invalid-document') throw new Error(`expected invalid-document, got ${JSON.stringify(result)}`)
  return result.error.violations.map((v) => v.path)
}

export function problemsOf(result: Result<unknown, WorldError>): string[] {
  if (result.ok || result.error.code !== 'inconsistent-world') throw new Error(`expected inconsistent-world, got ${JSON.stringify(result)}`)
  return result.error.problems.map((p) => p.message)
}

/** The document as JSON, for a test that edits it by hand. */
export function docOf(world: World): Record<string, any> {
  return JSON.parse(JSON.stringify(world.toJSON()))
}

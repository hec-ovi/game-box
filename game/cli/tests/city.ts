import { writeFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import { Forge } from '@gb/forge'
import type { AssetPackRef, Facing, Rect, World } from '@gb/world'
import { pinDesigns } from '../src/pins.ts'

/**
 * A city for the commands that read one, laid out and sealed with nobody asked
 * anything.
 *
 * A plan is arithmetic and so is a pin, so a file made here is the same file a
 * build writes but for the writing: the streets, the roads, every building with
 * its footprint and its pin, under the placeholder names a plan carries. The
 * writing is a model's and has no stand-in, so what needs a written city is not
 * tested here at all.
 */

/** A cell of the grid, by its column and its row. */
type Corner = { x: number; y: number }

/** What a test city is laid out from. Everything else is the forge's own default. */
export interface Town {
  readonly seed: string
  readonly blocksX?: number
  readonly blocksY?: number
  readonly blockCells?: number
  readonly density?: number
}

/** The town's architecture, or a thrown test failure saying the forge refused the brief. */
export function laidOut(town: Town): World {
  const plan = Forge.plan({
    theme: 'quiet coastal town',
    blocksX: 3,
    blocksY: 3,
    density: 0.8,
    maxStoreys: 3,
    exits: 1,
    ...town,
  })
  if (!plan.ok) throw new Error(`the forge refused the brief: ${plan.error.code}`)
  return plan.value
}

/** Pins the named buildings to the committed pack and writes the city out, the way every command that seals one does. */
export async function seal(
  file: string,
  world: World,
  plots: readonly string[],
  options: { generator: string; requires?: readonly AssetPackRef[] },
): Promise<void> {
  const pins = await pinDesigns(world, plots)
  if (pins.state !== 'pinned') throw new Error(`the city would not pin: ${pins.why}`)
  const bundle = await Bundle.pack(world, [], { generator: options.generator, requires: options.requires ?? [pins.pack] })
  writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`)
}

/** A whole city on disk: laid out, pinned and sealed under the label a build seals one with. */
export async function city(file: string, town: Town): Promise<World> {
  const world = laidOut(town)
  await seal(file, world, world.plots().map((plot) => plot.id), { generator: 'gb build' })
  return world
}

/**
 * A growth put up by hand: buildings on land nothing has claimed, numbered on
 * from the ones already standing.
 *
 * Growing a city for real hangs a sign over every door it adds and writes the
 * ones that open, which is a model's work. What a pack is cut from is the
 * records, so the records are what this puts there.
 */
export function growPlots(world: World, count: number): string[] {
  const like = world.plots()[0]
  if (!like) throw new Error('a city with no buildings has nothing to grow onto')
  const added: string[] = []
  for (let i = 0; i < count; i++) {
    const site = freeSite(world)
    if (!site) break
    const plot = world.addPlot({
      kind: like.kind,
      name: `Instance ${world.plots().length + 1}`,
      rect: site.rect,
      storeys: 2,
      entrance: { cell: site.cell, facing: site.facing },
      style: like.style,
    })
    if (!plot.ok) throw new Error(`the growth would not stand: ${JSON.stringify(plot.error)}`)
    added.push(plot.value.id)
  }
  if (!added.length) throw new Error('the town had no empty land left to grow onto')
  return added
}

/** The first free footprint with a sidewalk against one of its walls, which is where a door can go. */
function freeSite(world: World): { rect: Rect; cell: Corner; facing: Facing } | undefined {
  for (const size of [
    { w: 5, h: 6 },
    { w: 6, h: 5 },
    { w: 5, h: 5 },
  ]) {
    for (const rect of world.buildSites(size.w, size.h)) {
      const door = doorsOf(rect).find((one) => world.grid.at(one.cell.x, one.cell.y) === 'sidewalk')
      if (door) return { rect, ...door }
    }
  }
  return undefined
}

/** The four cells a footprint could take a door on, one against the middle of each wall. */
function doorsOf(rect: Rect): Array<{ cell: Corner; facing: Facing }> {
  const acrossMiddle = rect.x + Math.floor(rect.w / 2)
  const downMiddle = rect.y + Math.floor(rect.h / 2)
  return [
    { facing: 'south', cell: { x: acrossMiddle, y: rect.y + rect.h } },
    { facing: 'north', cell: { x: acrossMiddle, y: rect.y - 1 } },
    { facing: 'west', cell: { x: rect.x - 1, y: downMiddle } },
    { facing: 'east', cell: { x: rect.x + rect.w, y: downMiddle } },
  ]
}

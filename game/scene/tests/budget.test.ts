import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, STANDING_BUDGET, STREAM_BUDGET, type CityBuild, type CityOptions, type Dressing } from '../src/index.ts'
import { bigTown } from './town.ts'

/**
 * What a frame is allowed to build.
 *
 * One building is not one cost. On the town the game builds, a shell out of the
 * shipped pack is a fifth of a millisecond and a plot the pack has no shape for
 * is tens, so a ring that counted its builds would let one frame do forty times
 * the work of another and a walk into the downtown would stall on every tower.
 * The ring spends time instead: it stops as soon as the frame's share is gone,
 * and hands what it went over by to the frames after it, which build nothing
 * until it is paid off.
 */

/** How far the rings reach here: wide enough that arriving leaves a backlog several frames deep. */
const RINGS: CityOptions = { clutter: false, detail: 40, shell: 200 }

/** A dressing every call of which costs a fixed slice of wall clock, so a frame's share is a countable thing. */
function slow(ms: number): Dressing & { asked: string[] } {
  const grey = new Greybox()
  const asked: string[] = []
  const charge = (plotId: string) => {
    asked.push(plotId)
    const until = performance.now() + ms
    // spent rather than waited: a frame is charged for the time a build really takes
    while (performance.now() < until) continue
  }
  return {
    asked,
    building: (plot, size, charter) => {
      charge(plot.id)
      return grey.building(plot, size, charter)
    },
    shell: (plot, size, charter) => {
      charge(plot.id)
      return grey.shell(plot, size, charter)
    },
    lights: (plot, size) => grey.lights(plot, size),
    prop: (prop) => grey.prop(prop),
    character: (npc, doing) => grey.character(npc, doing),
    pickup: (item) => grey.pickup(item),
    ground: (kind) => grey.ground(kind),
    surface: (part) => grey.surface(part),
  }
}

/** A city standing in the middle of the big town, with the rings full of work and the first frame already taken. */
async function arrived(ms: number): Promise<{ city: CityBuild; dressing: Dressing & { asked: string[] }; at: { x: number; z: number } }> {
  const world = bigTown()
  const dressing = slow(ms)
  const city = buildCity(world, dressing, RINGS)
  const at = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
  city.follow(at.x, at.z, 1 / 60)
  return { city, dressing, at }
}

/** How many plots each of the next frames drew, walking a step that stays inside the cell. */
function frames(city: CityBuild, dressing: { asked: string[] }, at: { x: number; z: number }, count: number, step: number): number[] {
  const each: number[] = []
  for (let frame = 0; frame < count; frame++) {
    dressing.asked.length = 0
    city.follow(at.x + frame * step, at.z, 1 / 60)
    each.push(dressing.asked.length)
  }
  return each
}

/** How many frames the backlog takes to clear, moving `step` metres a frame. */
function cleared(city: CityBuild, dressing: { asked: string[] }, at: { x: number; z: number }, step: number): number {
  let quiet = 0
  for (let frame = 1; frame <= 400; frame++) {
    dressing.asked.length = 0
    city.follow(at.x + frame * step, at.z, 1 / 60)
    if (dressing.asked.length > 0) quiet = 0
    else if (++quiet >= 3) return frame - 2
  }
  return 400
}

describe('what one frame may build', () => {
  it('starts no build once the frame is spent, and rests until the overrun is paid off', async () => {
    // dearer than the whole of a standing frame, so one call is always an overrun
    const { city, dressing, at } = await arrived(STANDING_BUDGET + 4)
    const each = frames(city, dressing, at, 12, 0.02)

    expect(each.every((builds) => builds <= 1), `a frame built more than its share: ${each.join(',')}`).toBe(true)
    // the overrun is carried, so a frame that built has to be followed by frames that do not
    expect(each.filter((builds) => builds === 0).length, `every frame built, so nothing was carried: ${each.join(',')}`).toBeGreaterThan(each.length / 2)
    expect(each.some((builds) => builds === 1), `nothing was built at all, so the queue is not draining: ${each.join(',')}`).toBe(true)
  })

  it('clears the backlog in fewer frames where the player is standing still than where they are walking', async () => {
    const walking = await arrived(1)
    const standing = await arrived(1)

    const walked = cleared(walking.city, walking.dressing, walking.at, 0.02)
    const stood = cleared(standing.city, standing.dressing, standing.at, 0)

    expect(stood, `standing took ${stood} frames and walking ${walked}, so standing still buys nothing`).toBeLessThan(walked)
  })

  it('takes the whole backlog only when it is asked to settle', async () => {
    const { city, dressing, at } = await arrived(STREAM_BUDGET + 2)

    dressing.asked.length = 0
    city.follow(at.x + 40, at.z)
    expect(dressing.asked.length, 'a frame in a running game never takes more than its share, told an elapsed time or not').toBeLessThanOrEqual(1)

    dressing.asked.length = 0
    city.settle()
    expect(dressing.asked.length, 'a city opening or a ride behind a veil takes the lot, however long it costs').toBeGreaterThan(1)
  })
})

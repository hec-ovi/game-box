/**
 * Walk a real city, headless. Point it at a bundle written by `gb build` (or a
 * bare world document) and it puts one pedestrian on the pavement at one edge
 * of town, sends them to the other, and reports what they did: how far they
 * got, how many roads they crossed, and whether every one of those crossings
 * was at a crossing. Then it prices an ordinary crowd on the same city.
 *
 *   node tools/walk-city.ts ../../city.json [seed]
 *
 * The tests prove the same promises on a hand-laid town. This is how to check
 * them against a city the generator actually produced.
 */
import { CityNav } from '@gb/nav'
import { World } from '@gb/world'
import { readFileSync } from 'node:fs'
import { Crossings } from '../src/crossings.ts'
import { Crowd, type CrowdActor, type CrowdCast, type WalkerView } from '../src/index.ts'

const PAVEMENT = ['sidewalk', 'park'] as const

/** Bodies that do nothing, so the walking is all that is being measured. */
const NOBODY: CrowdCast = {
  spawn(): CrowdActor {
    return { placeAt() {}, faceTo() {}, play() {}, release() {} }
  },
}

function load(file: string): World {
  const document = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  const loaded = World.load(document.world ?? document)
  if (!loaded.ok) throw new Error(`${file}: ${loaded.error.code}`)
  return loaded.value
}

function main(): void {
  const file = process.argv[2]
  if (!file) throw new Error('usage: node tools/walk-city.ts <bundle.json> [seed]')
  const seed = process.argv[3] ?? 'walk-city'
  const world = load(file)
  const nav = CityNav.from(world)
  const crossings = Crossings.from(world, PAVEMENT)
  const across = world.grid.width * world.cellSize

  console.log(`${world.name}: ${world.grid.width}x${world.grid.height} cells, ${across.toFixed(0)} m across`)
  console.log(`  ${crossings.sides.count} stretches of pavement, ${crossings.count} crossings between them`)
  console.log(`  every stretch reachable from every other: ${joined(crossings) ? 'yes' : 'no'}`)

  // one walker, told to walk the width of the town, starting at the western kerb
  const start = kerb(world)
  const crowd = Crowd.create(
    { world, nav, cast: NOBODY, seed },
    {
      population: 1,
      spawnNear: 0,
      spawnFar: 12,
      tripMin: across * 0.6,
      tripMax: across,
      pauseMin: 0,
      pauseMax: 0.5,
      retireRadius: across * 4,
    },
  )

  const painted = paint(world, crossings)
  let west = Infinity
  let east = -Infinity
  let stepped = 0
  let mid = 0
  const onRoad = new Map<string, boolean>()
  for (let frame = 0; frame < 60 * 900; frame++) {
    crowd.update(1 / 60, start)
    for (const walker of crowd.walkers()) {
      west = Math.min(west, walker.x)
      east = Math.max(east, walker.x)
      const cell = under(world, walker)
      const road = world.grid.at(cell.x, cell.y) === 'street'
      if (road && !(onRoad.get(walker.id) ?? false)) {
        stepped++
        if (!painted.has(cell.y * world.grid.width + cell.x)) mid++
      }
      onRoad.set(walker.id, road)
    }
  }

  console.log(`  walked from x=${west.toFixed(0)} m to x=${east.toFixed(0)} m of ${across.toFixed(0)} m`)
  console.log(`  stepped off the kerb ${stepped} times, ${stepped - mid} at a crossing, ${mid} mid-block`)
  console.log(`  ${price(world, nav, seed, 32)}`)
}

/** True when the crossings tie every stretch of pavement into one network. */
function joined(crossings: Crossings): boolean {
  const of = new Int32Array(crossings.sides.count).map((_, i) => i)
  const root = (a: number): number => (of[a] === a ? a : (of[a] = root(of[a]!)))
  for (const crossing of crossings.all()) of[root(crossing.nearSide)] = root(crossing.farSide)
  for (let side = 0; side < crossings.sides.count; side++) if (root(side) !== root(0)) return false
  return crossings.sides.count > 0
}

/** Which cell somebody is standing in. */
function under(world: World, walker: WalkerView): { x: number; y: number } {
  return { x: Math.floor(walker.x / world.cellSize), y: Math.floor(walker.z / world.cellSize) }
}

/** The roadway cells a crossing runs over, as one lookup. */
function paint(world: World, crossings: Crossings): Set<number> {
  const cells = new Set<number>()
  for (const crossing of crossings.all()) {
    for (const cell of Crossings.road(crossing)) cells.add(cell.y * world.grid.width + cell.x)
  }
  return cells
}

/** A pavement cell near the western edge of the built area, in metres. */
function kerb(world: World): { x: number; z: number } {
  for (let x = 0; x < world.grid.width; x++) {
    for (let y = 0; y < world.grid.height; y++) {
      const kind = world.grid.at(x, y)
      if (kind === 'sidewalk' || kind === 'park') {
        return { x: (x + 0.5) * world.cellSize, z: (y + 0.5) * world.cellSize }
      }
    }
  }
  throw new Error('this city has no pavement in it')
}

/** What a full crowd costs per update on this city, in microseconds. */
function price(world: World, nav: CityNav, seed: string, population: number): string {
  const crowd = Crowd.create({ world, nav, cast: NOBODY, seed }, { population })
  const middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
  for (let i = 0; i < 600; i++) crowd.update(1 / 60, middle)
  let best = Infinity
  let worst = 0
  for (let round = 0; round < 5; round++) {
    const started = process.hrtime.bigint()
    for (let i = 0; i < 3000; i++) {
      const frame = process.hrtime.bigint()
      crowd.update(1 / 60, middle)
      worst = Math.max(worst, Number(process.hrtime.bigint() - frame) / 1e6)
    }
    best = Math.min(best, Number(process.hrtime.bigint() - started) / 1e3 / 3000)
  }
  return `${population} walkers: ${best.toFixed(1)} us per update, worst frame ${worst.toFixed(3)} ms`
}

main()

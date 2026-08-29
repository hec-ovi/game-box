import { Rng } from '@gb/kit'
import { MAX_GRID_SIDE, PLOT_BAND, TALLEST_STOREYS, World, inPlotBand, plotShape, type CellKind } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { BANDS, BLOCKS_MAX, briefContract, Forge, MOUNTAIN_CELLS } from '../src/index.ts'
import { avenueCount, Avenues } from '../src/layout/avenues.ts'
import { streetLines } from '../src/layout/lines.ts'
import { MAX_BLOCK, MIN_BLOCK, planStreets, widestGrid } from '../src/layout/plan.ts'
import { cutsFourWays } from '../src/layout/plots.ts'
import { digest, planned } from './support.ts'


interface Cell {
  x: number
  y: number
}

/** Every cell the road graph claims: each segment's centreline, and its own width of roadway around it. */
function roadway(world: World): { centres: Cell[]; cells: Cell[] } {
  const { nodes, segments } = world.toJSON().roads
  const cellOf = (id: string) => nodes.find((node) => node.id === id)!.cell
  const centres = new Map<string, Cell>()
  const cells = new Map<string, Cell>()

  for (const segment of segments) {
    const from = cellOf(segment.from)
    const to = cellOf(segment.to)
    const half = BANDS[segment.kind].halfRoadway
    const step = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) }
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    for (let i = 0; i <= length; i++) {
      const centre = { x: from.x + step.x * i, y: from.y + step.y * i }
      centres.set(`${centre.x},${centre.y}`, centre)
      for (let n = -half; n <= half; n++) {
        const cell = step.x === 0 ? { x: centre.x + n, y: centre.y } : { x: centre.x, y: centre.y + n }
        cells.set(`${cell.x},${cell.y}`, cell)
      }
    }
  }
  return { centres: [...centres.values()], cells: [...cells.values()] }
}

/** The town without its buildings: streets, pavement, squares and mountains. */
function skeleton(world: World): string {
  return world.grid
    .rows()
    .map((row) => row.replace(/B/g, '.'))
    .join('\n')
}

/** Is there an open square in this town, this many cells across? Bigger than any pavement a band leaves. */
function hasSquare(world: World, side: number): boolean {
  const open = (x: number, y: number) => {
    const kind = world.grid.at(x, y)
    return kind === 'park' || kind === 'sidewalk'
  }
  for (let y = 0; y + side <= world.grid.height; y++) {
    for (let x = 0; x + side <= world.grid.width; x++) {
      let all = true
      for (let dy = 0; all && dy < side; dy++) for (let dx = 0; dx < side; dx++) if (!open(x + dx, y + dy)) { all = false; break }
      if (all) return true
    }
  }
  return false
}

describe('the street plan', () => {
  it('paints junctions like junctions: roadway right through, pavement only on the corners', () => {
    const world = planned('junctions', { exits: 4 })
    const { centres, cells } = roadway(world)
    const kindsAt = (list: Cell[]) => new Set<CellKind | undefined>(list.map((cell) => world.grid.at(cell.x, cell.y)))

    // a car drives the whole graph without meeting a 15 cm kerb, and no pavement sits on the roadway
    expect(centres.length).toBeGreaterThan(200)
    expect([...kindsAt(centres)]).toEqual(['street'])
    expect([...kindsAt(cells)]).toEqual(['street'])

    // and nowhere in town is there a pavement cell with roadway on both sides of it,
    // which is a street lamp standing in the middle of the road
    const stranded: string[] = []
    for (let y = 1; y < world.grid.height - 1; y++) {
      for (let x = 1; x < world.grid.width - 1; x++) {
        if (world.grid.at(x, y) !== 'sidewalk') continue
        const road = (dx: number, dy: number) => world.grid.at(x + dx, y + dy) === 'street'
        if ((road(-1, 0) && road(1, 0)) || (road(0, -1) && road(0, 1))) stranded.push(`${x},${y}`)
      }
    }
    expect(stranded).toEqual([])

    // the pavement is still there: every crossing keeps a corner of it in each quarter,
    // one cell past the widest roadway that meets there
    const { nodes, segments } = world.toJSON().roads
    const arms = (id: string) => segments.filter((s) => s.from === id || s.to === id)
    const crossings = nodes.filter((node) => arms(node.id).length > 1)
    expect(crossings.length).toBeGreaterThan(3)
    for (const node of crossings) {
      const reach = Math.max(...arms(node.id).map((s) => BANDS[s.kind].halfRoadway)) + 1
      for (const dx of [-reach, reach]) {
        for (const dy of [-reach, reach]) {
          const corner = { x: node.cell.x + dx, y: node.cell.y + dy }
          expect(world.grid.at(corner.x, corner.y), `corner at ${corner.x},${corner.y}`).toBe('sidewalk')
        }
      }
    }
  })

  it('plans the town off the streets stream alone, and paints exactly what it planned', () => {
    // the plan is the only place a street number comes from: read it here with
    // nothing but the seed, and the town the forge paints has to agree with it,
    // twice over. A draw added before the fork, or a second stream drawing the
    // plan, shows up as a town that no longer matches its own plan.
    for (const seed of ['ash', 'birch', 'cedar']) {
      const brief = { blocksX: 4, blocksY: 3 }
      const plan = planStreets(brief, new Rng(seed).fork('streets'))
      expect(digest(plan), seed).toBe(digest(planStreets(brief, new Rng(seed).fork('streets'))))

      const world = planned(seed, brief)
      expect([world.grid.width, world.grid.height], seed).toEqual([plan.size.width, plan.size.height])
      // and the bands read back off the road graph are the ones the plan laid, roads out left aside
      expect(streetLines(world), seed).toEqual({ columns: plan.columns, rows: plan.rows })

      // and every band is painted where the plan put it, at its own class's
      // width: pavement, roadway, pavement, read across the middle of a block
      const block = plan.blocks[0]!
      const across = (line: (typeof plan.columns)[number], at: number, cell: (i: number) => CellKind | undefined) => {
        const road = BANDS[line.kind]
        for (let i = 0; i < line.width; i++) {
          const want = i < road.pavement || i >= road.pavement + road.roadway ? 'sidewalk' : 'street'
          expect(cell(line.start + i), `${seed}: ${line.kind} band at ${line.start}+${i}, ${at}`).toBe(want)
        }
        expect(cell(line.centre), `${seed}: centreline of the ${line.kind} at ${line.centre}`).toBe('street')
      }
      for (const line of plan.columns) across(line, block.y + 1, (x) => world.grid.at(x, block.y + 1))
      for (const line of plan.rows) across(line, block.x + 1, (y) => world.grid.at(block.x + 1, y))
    }
  })

  it('cuts blocks so buildings face all four ways', () => {
    // whatever size the seed picks, a block is deep enough for doors on its east and west sides
    for (const seed of ['facings', 'ash', 'birch', 'cedar']) {
      const plan = planStreets({ blocksX: 3, blocksY: 3 }, new Rng(seed).fork('streets'))
      for (const block of plan.blocks) {
        expect(cutsFourWays(Math.min(block.w, block.h)), `${seed}: a ${block.w}x${block.h} block`).toBe(true)
      }
    }

    const world = planned('facings')
    const facing = (which: string) => world.plots().filter((plot) => plot.entrance.facing === which).length
    for (const which of ['north', 'south', 'east', 'west']) {
      expect(facing(which), `${which}-facing doors`).toBeGreaterThan(0)
    }
  })

  it('reads as a different town for a different seed', () => {
    const seeds = ['ash', 'birch', 'cedar', 'dune', 'elm', 'fir']
    const towns = seeds.map((seed) => planned(seed))

    expect(new Set(towns.map(skeleton)).size).toBe(seeds.length)
    expect(new Set(towns.map((town) => digest(town.toJSON().roads))).size).toBe(seeds.length)
    // block sizes differ, so the towns are not one grid at different scales
    expect(new Set(towns.map((town) => `${town.grid.width}x${town.grid.height}`)).size).toBeGreaterThan(3)
    // and some of them leave a block open as a square or a green
    expect(towns.some((town) => hasSquare(town, MIN_BLOCK))).toBe(true)
  })

  it('lays the blocks the brief asked for when it asks', () => {
    const world = planned('pinned', { blocksX: 1, blocksY: 1, blockCells: 30 })
    // one block has two street bands round it and no avenue: a town needs an inner street for a spine
    const around = (cells: number) => MOUNTAIN_CELLS * 2 + BANDS.street.width * 2 + cells

    expect(world.grid.width).toBeGreaterThanOrEqual(around(28))
    expect(world.grid.width).toBeLessThanOrEqual(around(33))
  })

  it('never plans a town bigger than the brief measured it at, up to the biggest brief there is', () => {
    const specs = [
      { blocksX: 3, blocksY: 3 },
      { blocksX: 1, blocksY: 1, blockCells: 30 },
      // the widest block there is, where the jitter has nowhere to go and the
      // only slack left in the bound is the bands themselves
      { blocksX: 2, blocksY: 2, blockCells: MAX_BLOCK },
      { blocksX: 5, blocksY: 5, blockCells: MAX_BLOCK },
      { blocksX: BLOCKS_MAX, blocksY: BLOCKS_MAX, blockCells: MIN_BLOCK },
    ]
    for (const spec of specs) {
      for (const seed of ['ash', 'birch', 'cedar', 'dune', 'elm', 'fir']) {
        const plan = planStreets(spec, new Rng(seed).fork('streets'))
        const widest = widestGrid(spec)
        const asked = `${spec.blocksX}x${spec.blocksY} of ${spec.blockCells ?? 'any'} on ${seed}`
        expect(plan.size.width, asked).toBeLessThanOrEqual(widest.width)
        expect(plan.size.height, asked).toBeLessThanOrEqual(widest.height)
        // and what the brief allows is a grid the world will actually found
        const found = World.found({ name: 'Edge', theme: 'plain', seed, width: plan.size.width, height: plan.size.height })
        expect(found.ok, `${asked}: ${plan.size.width}x${plan.size.height}`).toBe(true)
      }
    }
  })

  it('refuses a brief that asks for more city than a world can hold', () => {
    // the ceiling is the world's, read from it, so raising the world raises this
    const over = { theme: 'sprawl', seed: 'too-big', blocksX: 42, blocksY: 1, blockCells: MAX_BLOCK }
    // the brief says no on its own, before a single cell is allocated
    const big = briefContract.parse(over)
    expect(big.ok).toBe(false)
    if (!big.ok) expect(big.error[0]!.message).toContain(String(MAX_GRID_SIDE))

    const wordy = briefContract.parse({ theme: 'a rain-soaked port city '.repeat(4), seed: 'wordy' })
    expect(wordy.ok).toBe(false)
    if (!wordy.ok) expect(wordy.error[0]!.path).toBe('theme')

    // and the forge hands it back as an error instead of throwing out of a world constructor
    const laid = Forge.plan(over)
    expect(laid.ok).toBe(false)
    if (!laid.ok) expect(laid.error.code).toBe('invalid-brief')
  })

  it('takes the fifty-block city the owner asked for', () => {
    // 50 blocks of ordinary cells is 1,587 a side: under the world's ceiling and
    // over the one the brief used to carry
    const fifty = briefContract.parse({ theme: 'sprawl', seed: 'fifty', blocksX: 50, blocksY: 50 })
    expect(fifty.ok, JSON.stringify(fifty.ok ? null : fifty.error)).toBe(true)
    expect(widestGrid({ blocksX: 50, blocksY: 50 }).width).toBeLessThanOrEqual(MAX_GRID_SIDE)
  })
})

describe('the avenues', () => {
  /** Which lines of an axis are avenues, as ordinals. */
  const spines = (lines: readonly { kind: string }[]) =>
    lines.flatMap((line, index) => (line.kind === 'avenue' ? [index] : []))

  it('gives every town a spine, spread out, and never two side by side', () => {
    // eight blocks is the tightest a town gets: two avenues with four inner
    // streets to put them on, which is where a pair could end up side by side
    for (const blocks of [2, 4, 6, 8, 9, 12, 20]) {
      for (const seed of ['ash', 'birch', 'cedar', 'dune', 'elm', 'fir', 'gorse', 'holly']) {
        const plan = planStreets({ blocksX: blocks, blocksY: blocks }, new Rng(seed).fork('streets'))
        for (const lines of [plan.columns, plan.rows]) {
          const avenues = spines(lines)
          const where = `${blocks} blocks on ${seed}: ${avenues.join(',')} of ${lines.length}`
          expect(avenues.length, where).toBe(avenueCount(lines.length))
          // an axis with an inner street has a main one, and they thin out rather than stack up.
          // an axis with none left after the merges is one long block, and has nothing to promote
          if (lines.length >= 3) {
            expect(avenues.length, where).toBeGreaterThan(0)
            expect(avenues.length, where).toBeLessThanOrEqual(Math.ceil(lines.length / 4))
          }
          // never the ring road round the edge of town, and never a pair with one street between
          expect(avenues.every((index) => index > 0 && index < lines.length - 1), where).toBe(true)
          for (let i = 1; i < avenues.length; i++) expect(avenues[i]! - avenues[i - 1]!, where).toBeGreaterThan(1)
        }
      }
    }
  })

  it('lays an avenue wider than the streets it crosses, and says so in the graph', () => {
    const world = planned('spines', { blocksX: 6, blocksY: 6 })
    const { nodes, segments } = world.toJSON().roads
    const cellOf = (id: string) => nodes.find((node) => node.id === id)!.cell
    expect(new Set(segments.map((segment) => segment.kind))).toContain('avenue')

    for (const segment of segments) {
      if (segment.kind === 'exit') continue
      const from = cellOf(segment.from)
      const to = cellOf(segment.to)
      // measured across the middle of the stretch, which is never a junction mouth
      const mid = { x: (from.x + to.x) >> 1, y: (from.y + to.y) >> 1 }
      const step = from.y === to.y ? { x: 0, y: 1 } : { x: 1, y: 0 }
      let span = 1
      for (const way of [1, -1]) {
        for (let n = 1; world.grid.at(mid.x + step.x * n * way, mid.y + step.y * n * way) === 'street'; n++) span++
      }
      expect(span, `a ${segment.kind} at ${mid.x},${mid.y}`).toBe(BANDS[segment.kind].roadway)
      expect(segment.lanes, `a ${segment.kind} at ${mid.x},${mid.y}`).toBe(BANDS[segment.kind].lanes)
    }
  })

  it('leaves the valley along a spine', () => {
    // the way out of town is the town's own main road carrying on
    for (const seed of ['ash', 'birch', 'cedar', 'dune']) {
      const plan = planStreets({ blocksX: 5, blocksY: 5, exits: 4 }, new Rng(seed).fork('streets'))
      const avenues = Avenues.from(plan.columns, plan.rows)
      for (const exit of plan.exits) {
        // the road out runs along the band it continues, so that band is the avenue
        const along = exit.edge.x === exit.junction.x ? { x: exit.junction.x, y: 0 } : { x: 0, y: exit.junction.y }
        expect(avenues.has(along), `${seed}: the road out at ${exit.junction.x},${exit.junction.y}`).toBe(true)
      }
    }
  })

  it('gives the city a skyline: a few towers where a town stacks, low buildings everywhere else', () => {
    // pooled over seeds, because a ten block town raises a dozen towers and one
    // town's dozen says nothing about where a rule puts them
    interface Standing {
      readonly storeys: number
      readonly onSpine: boolean
      readonly fromMiddle: number
    }
    const town: Standing[] = []
    for (const seed of ['skyline', 'metro', 'harbour', 'kite']) {
      const world = planned(seed, { theme: 'a neon port city', blocksX: 10, blocksY: 10, density: 1 })
      const lines = streetLines(world)
      const avenues = Avenues.from(lines.columns, lines.rows)
      const middle = { x: world.grid.width / 2, y: world.grid.height / 2 }
      for (const plot of world.plots()) {
        // every footprint is inside the band, whatever the height: only storeys leave it
        const shape = plotShape(plot)
        expect(inPlotBand({ ...shape, storeys: PLOT_BAND.storeys.min }), `${plot.id} ${JSON.stringify(shape)}`).toBe(true)
        town.push({
          storeys: plot.storeys,
          onSpine: avenues.has(plot.entrance.cell),
          fromMiddle: Math.hypot(plot.entrance.cell.x - middle.x, plot.entrance.cell.y - middle.y),
        })
      }
    }
    const towers = town.filter((one) => one.storeys > PLOT_BAND.storeys.max)

    // a skyline, not a plateau: a quarter of a dense town stacks, the rest is
    // the street it always was
    expect(towers.length / town.length).toBeGreaterThan(0.1)
    expect(towers.length / town.length).toBeLessThan(0.35)
    // and real height on the ones that are raised, with a spread rather than one number
    expect(Math.max(...towers.map((one) => one.storeys))).toBeGreaterThan(12)
    expect(new Set(towers.map((one) => one.storeys)).size).toBeGreaterThan(6)

    // they stand where a town puts its height: towards the middle, and along
    // the avenues, which carry both the extra storey inside the band and the
    // spine's share of the field over it. Those two are the whole of it, because
    // how tall a building stands is settled before anybody says what it is:
    // measured over these four seeds, 4.89 storeys on the spine to 4.48 off it
    const out = (list: Standing[]) => list.reduce((sum, one) => sum + one.fromMiddle, 0) / list.length
    expect(out(towers)).toBeLessThan(out(town) * 0.95)
    const mean = (list: Standing[]) => list.reduce((sum, one) => sum + one.storeys, 0) / list.length
    const spine = town.filter((one) => one.onSpine)
    expect(mean(spine)).toBeGreaterThan(mean(town.filter((one) => !one.onSpine)) * 1.05)

    // the height is a downtown rather than a field: the third of town nearest
    // the middle stacks many times more often than the third out at the rim
    const byMiddle = [...town].sort((a, b) => a.fromMiddle - b.fromMiddle)
    const third = Math.floor(byMiddle.length / 3)
    const raised = (list: Standing[]) => list.filter((one) => one.storeys > PLOT_BAND.storeys.max).length / list.length
    expect(raised(byMiddle.slice(0, third))).toBeGreaterThan(raised(byMiddle.slice(-third)) * 3)
  })

  it('takes the height the brief allows and changes nothing else about the town', () => {
    const brief = { theme: 'a neon port city', blocksX: 6, blocksY: 6, density: 1 }
    const cut = (maxStoreys: number) => planned('ceiling', { ...brief, maxStoreys }).plots()
    const flat = cut(PLOT_BAND.storeys.max)
    const tall = cut(TALLEST_STOREYS)

    // a brief inside the band cannot raise a thing, and one over it reaches for it
    expect(Math.max(...flat.map((plot) => plot.storeys))).toBe(PLOT_BAND.storeys.max)
    expect(Math.max(...tall.map((plot) => plot.storeys))).toBeGreaterThan(12)

    // and the skyline's own draws come off a stream of their own, so raising the
    // ceiling moves nothing but the height of the plots it raised: the same
    // buildings, of the same kinds, on the same footprints, with the same names,
    // and the same doors open. A city asked for inside the band is the city it
    // has always been
    const exceptHeight = (plots: typeof flat) => plots.map(({ storeys, ...rest }) => rest)
    expect(exceptHeight(tall)).toEqual(exceptHeight(flat))

    const raised = tall.filter((plot, at) => plot.storeys !== flat[at]!.storeys)
    expect(raised.length).toBeGreaterThan(0)
    // and every plot the ceiling raised clears the band, so a raised plot is always a tower
    for (const plot of raised) expect(plot.storeys, plot.id).toBeGreaterThan(PLOT_BAND.storeys.max)
  })

  it('stacks a dense town and spreads a sparse one', () => {
    const brief = { theme: 'a neon port city', blocksX: 10, blocksY: 10 }
    const towers = (density: number) =>
      planned('density', { ...brief, density }).plots().filter((plot) => plot.storeys > PLOT_BAND.storeys.max).length

    expect(towers(1)).toBeGreaterThan(towers(0.2))
  })

  it('builds taller on the avenue than on the street behind it', () => {
    const brief = { blocksX: 6, blocksY: 6, maxStoreys: 6 }
    const plan = planStreets(brief, new Rng('spines').fork('streets'))
    const avenues = Avenues.from(plan.columns, plan.rows)
    const world = planned('spines', brief)

    const height = (plots: ReturnType<typeof world.plots>) => plots.reduce((sum, plot) => sum + plot.storeys, 0) / plots.length
    const on = world.plots().filter((plot) => avenues.has(plot.entrance.cell))
    const off = world.plots().filter((plot) => !avenues.has(plot.entrance.cell))

    expect(on.length).toBeGreaterThan(20)
    expect(off.length).toBeGreaterThan(20)
    // a storey taller, less whatever the ceiling and the mix of kinds take back
    expect(height(on)).toBeGreaterThan(height(off) + 0.4)
  })
})

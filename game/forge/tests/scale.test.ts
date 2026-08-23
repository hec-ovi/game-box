import { Rng } from '@gb/kit'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { summarise } from '../src/index.ts'
import { questDemand } from '../src/quests/demand.ts'
import { line, playEvery } from './playable.ts'
import { buildTown, digest } from './support.ts'

/** Places with somebody in them: what the amount of work in a town is measured against. */
const peopled = (world: Parameters<typeof summarise>[0]) => summarise(world).places.filter((place) => place.npcs.length > 0).length

const BANDS = ['errand', 'small', 'standard', 'hard', 'epic']

const ranked = (quests: readonly { difficulty?: string | undefined }[]): number[] =>
  quests.map((quest) => BANDS.indexOf(quest.difficulty ?? 'small')).sort((a, b) => a - b)

/** The middling job in a town: what most of its work feels like. */
const median = (quests: readonly { difficulty?: string | undefined }[]): string => BANDS[ranked(quests)[Math.floor(quests.length / 2)]!]!

/** One city and one small town off the same seed: everything below is one measured against the other. */
const [city, town] = await Promise.all([
  buildTown('scale-city', { blocksX: 18, blocksY: 18 }),
  buildTown('scale-city', { blocksX: 6, blocksY: 6 }),
])

describe('a town offers as much as it holds', () => {
  it('builds the same town twice at a size where the amount of work is not fixed', async () => {
    const [a, b] = await Promise.all([buildTown('scale-same', { blocksX: 10, blocksY: 10 }), buildTown('scale-same', { blocksX: 10, blocksY: 10 })])
    expect(a.quests.length).toBeGreaterThan(30)
    expect(digest(a.quests)).toBe(digest(b.quests))
    expect(digest(a.world.toJSON())).toBe(digest(b.world.toJSON()))
  })

  it('gives a big city more to do than a small town, at about the same density per street', () => {
    expect(city.quests.length).toBeGreaterThan(town.quests.length * 4)
    const density = (place: typeof city) => place.quests.length / peopled(place.world)
    expect(density(city)).toBeGreaterThan(density(town) * 0.75)
    expect(density(city)).toBeLessThan(density(town) * 1.25)
  })

  it('does not offer every town of one size the same amount of work', async () => {
    const towns = await Promise.all(
      ['vary-1', 'vary-2', 'vary-3', 'vary-4', 'vary-5', 'vary-6'].map((seed) => buildTown(seed, { blocksX: 8, blocksY: 8 })),
    )
    const counts = towns.map((built) => built.quests.length)
    expect(new Set(counts).size).toBeGreaterThan(3)
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThan(Math.min(...counts) * 0.15)
  })

  it('never asks for more work than the town has things and people to make it out of', () => {
    // forty front rooms, three things in the whole place: the density would ask for sixteen jobs
    const bare = {
      cityName: 'Thin',
      theme: 'plain town',
      places: Array.from({ length: 40 }, (_, i) => ({
        plotId: `plot_${i}`,
        kind: 'house' as const,
        name: `Number ${i}`,
        door: { x: i * 12, z: 0 },
        npcs: [{ npcId: `npc_${i}`, name: `Somebody ${i}`, role: 'resident' as const }],
        items: i < 3 ? [{ itemId: `item_${i}`, name: 'A box' }] : [],
      })),
    }
    expect(questDemand(bare, new Rng('thin'))).toBe(3)
  })

  it('does not want the same amount of work out of one town on every seed', () => {
    // the town is held still, so only the seed is moving
    const asked = ['one', 'two', 'three', 'four', 'five'].map((seed) => questDemand(summarise(town.world), new Rng(seed)))
    expect(new Set(asked).size).toBeGreaterThan(2)
  })

  it('asks about as much of the player per job in a city as in a small town, and adds a tail that crosses town', () => {
    // the middling job is about the same size of job either way: a city is more
    // neighbourhoods, not longer errands. A band apart is as far as the two go,
    // in either direction: a town with two dozen jobs in it has its median
    // sitting on a boundary, so which side of it the middle job falls is noise
    const band = (quests: typeof city.quests) => BANDS.indexOf(median(quests))
    expect(Math.abs(band(city.quests) - band(town.quests)), `${median(city.quests)} in a city against ${median(town.quests)} in a town`).toBeLessThanOrEqual(1)
    // and a city holds far more of the work that crosses a town. The biggest
    // single job is not the measure: a small town throws one up on about half
    // its seeds, so the top of the range is one draw rather than a property.
    // The main line is measured out differently again: its two sides are the two
    // ends of the town's own argument, so its longest link spans whatever town
    // it is in
    const crossing = (built: typeof city) => built.quests.filter((quest) => quest.kind === 'side' && quest.difficulty === 'epic').length
    expect(crossing(city), `${crossing(city)} jobs cross the city, ${crossing(town)} cross the town`).toBeGreaterThan(crossing(town) * 4)
    expect(city.quests.filter((quest) => quest.difficulty === 'epic').length).toBeLessThan(city.quests.length * 0.2)
  })

  it('writes nothing unplayable, however much of it there is', () => {
    expect(city.quests.length).toBeGreaterThan(150)
    expect(city.rejected).toEqual([])
    // both roads of every fork, by somebody with the verbs the game has
    const report = playEvery(city.world, city.quests)
    expect(report.stranded.map((run) => `${run.title} [${run.status}]`), 'a city wrote work that stops for no reason anybody owes').toEqual([])
    expect(report.completable, line(report)).toBe(report.quests)
    for (const run of report.runs) if (run.completable) expect(run.paid, `${run.title} finished and paid nothing`).toBeGreaterThan(0)
  })

  it('never walks somebody to the door they are already standing at', () => {
    const standing = new Map(summarise(city.world).places.flatMap((place) => place.npcs.map((npc) => [npc.npcId, place.plotId])))
    const escorts = city.quests.flatMap((quest) => quest.steps.filter((step) => step.kind === 'escort').map((step) => ({ quest, step })))

    expect(escorts.length).toBeGreaterThan(0)
    for (const { quest, step } of escorts) {
      const to = 'plotId' in step.place ? step.place.plotId : undefined
      expect(to, quest.title).not.toBe(standing.get(step.npcId))
    }
  })

  it('never promises one thing or one person to two jobs', () => {
    const wanted = new Map<string, string>()
    const jobs = new Map<string, number>()
    for (const quest of city.quests) {
      jobs.set(quest.giverNpcId, (jobs.get(quest.giverNpcId) ?? 0) + 1)
      for (const step of quest.steps) {
        if (step.kind !== 'collect') continue
        for (const itemId of [step.itemId, ...(step.alternates ?? [])]) {
          expect(wanted.get(itemId), `${itemId} is wanted by ${wanted.get(itemId)} and ${quest.title}`).toBeUndefined()
          wanted.set(itemId, quest.title)
        }
      }
    }
    expect(Math.max(...jobs.values())).toBeLessThanOrEqual(4)
  })
})

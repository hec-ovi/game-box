import { Rng } from '@gb/kit'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { summarise } from '../src/index.ts'
import { questDemand } from '../src/quests/demand.ts'
import { line, playEvery } from './playable.ts'
import { buildTown, digest } from './support.ts'

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
    expect(a.quests.length).toBeGreaterThan(6)
    expect(digest(a.quests)).toBe(digest(b.quests))
    expect(digest(a.world.toJSON())).toBe(digest(b.world.toJSON()))
  })

  it('gives a city no more to do than a town, because a city\'s size is scenery', () => {
    // nine times the buildings, and the work follows the cast rather than the
    // scenery: a share of every plot wrote 159 jobs into a twenty-block town
    // and 3 into a two-block one
    expect(city.world.plots().length).toBeGreaterThan(town.world.plots().length * 5)
    // a city opens more doors than a town, and is still mostly frontage
    expect(city.world.interiors().length).toBeGreaterThanOrEqual(town.world.interiors().length)
    expect(city.world.interiors().length / city.world.plots().length).toBeLessThan(0.05)
    // the work follows the cast up to a ceiling, and past it a bigger city is a
    // bigger place to walk around rather than a longer list of errands: nobody
    // plays three hundred side jobs, and each one is a call before the city can
    // be walked into
    expect(city.quests.length).toBeGreaterThanOrEqual(town.quests.length)
    expect(city.quests.length).toBeLessThan(town.quests.length * 5)
    const density = (built: typeof city) => built.quests.length / built.world.npcs().length
    expect(density(city), 'a city writes work for a share of a much bigger cast').toBeLessThan(density(town))
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

  it('pays its jobs over the bands rather than paying every errand the same', () => {
    // every errand in a city of three places is a walk between two of them, so
    // the bands have to be measured against that walk or the whole list comes
    // out epic and the finale is worth no more than a fetch
    for (const built of [city, town]) {
      const bands = new Set(built.quests.map((quest) => quest.difficulty))
      expect(bands.size, `${built.world.name} pays every job the same: ${[...bands].join(', ')}`).toBeGreaterThan(2)
      expect(built.quests.filter((quest) => quest.difficulty === 'epic').length).toBeLessThan(built.quests.length * 0.5)
    }
    // a city's places stand further apart than a town's, so its middling job is
    // the harder one, and never the easier
    const band = (quests: typeof city.quests) => BANDS.indexOf(median(quests))
    expect(band(city.quests), `${median(city.quests)} in a city against ${median(town.quests)} in a town`).toBeGreaterThanOrEqual(band(town.quests))
  })

  it('writes nothing unplayable, however much of it there is', () => {
    expect(city.quests.length).toBeGreaterThan(8)
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

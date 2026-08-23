import { Rng } from '@gb/kit'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { summarise } from '../src/index.ts'
import { questDemand } from '../src/quests/demand.ts'
import { playThrough } from './drive.ts'
import { buildTown, digest } from './support.ts'

/** Places with somebody in them: what the amount of work in a town is measured against. */
const peopled = (world: Parameters<typeof summarise>[0]) => summarise(world).places.filter((place) => place.npcs.length > 0).length

const BANDS = ['errand', 'small', 'standard', 'hard', 'epic']

const ranked = (quests: readonly { difficulty?: string | undefined }[]): number[] =>
  quests.map((quest) => BANDS.indexOf(quest.difficulty ?? 'small')).sort((a, b) => a - b)

/** The middling job in a town: what most of its work feels like. */
const median = (quests: readonly { difficulty?: string | undefined }[]): string => BANDS[ranked(quests)[Math.floor(quests.length / 2)]!]!

/** The biggest job a town has in it. */
const hardest = (quests: readonly { difficulty?: string | undefined }[]): number => ranked(quests).at(-1)!

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
    // neighbourhoods, not longer errands. It may sit one band up and no further,
    // because a town of frontage has fewer places open for a job to be about, so
    // the writer reaches for a longer shape a little more often
    const band = (quests: typeof city.quests) => BANDS.indexOf(median(quests))
    expect(band(city.quests) - band(town.quests)).toBeGreaterThanOrEqual(0)
    expect(band(city.quests) - band(town.quests)).toBeLessThanOrEqual(1)
    // and only a city is big enough to hold a side job that crosses it. The main
    // line is measured out differently: its two sides are the two ends of the
    // town's own argument, so its longest link spans whatever town it is in
    const sides = (built: typeof city) => built.quests.filter((quest) => quest.kind === 'side')
    expect(hardest(sides(city))).toBeGreaterThan(hardest(sides(town)))
    expect(city.quests.filter((quest) => quest.difficulty === 'epic').length).toBeLessThan(city.quests.length * 0.2)
  })

  it('writes nothing unplayable, however much of it there is', () => {
    expect(city.quests.length).toBeGreaterThan(150)
    expect(city.rejected).toEqual([])
    for (const quest of city.quests) {
      // both ways round, so a choice is proved on either branch
      for (const choose of [() => 0, () => 1]) {
        const player = PlayerState.create(city.world.id)
        for (const need of quest.requires ?? []) if (need.kind === 'flag') player.setFlag(need.flag, need.value)
        const log = QuestLog.create(city.quests, player)
        expect(log.start(quest.id).ok, quest.title).toBe(true)
        expect(playThrough(quest, log, player, choose), quest.title).toBe('complete')
        expect(player.money).toBeGreaterThan(0)
      }
    }
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

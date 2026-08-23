import { PlayerState } from '@gb/play'
import { QuestLog, REWARD_TABLE, type QuestDoc } from '@gb/quest'
import { METRICS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { secondsToWalk } from '../src/quests/pace.ts'
import { playThrough } from './drive.ts'
import { buildTown, digest } from './support.ts'

/** A handful of towns, built once, that the measurements below all read. */
const towns = await Promise.all([
  buildTown('recipes-1'),
  buildTown('recipes-2'),
  buildTown('recipes-3', { theme: 'dense neon port city' }),
  buildTown('recipes-4', { theme: 'quiet coastal town' }),
  buildTown('recipes-5', { theme: 'farming village on the plains', blocksX: 4, blocksY: 3 }),
  buildTown('recipes-6', { theme: 'cold industrial rail town', blocksX: 2, blocksY: 2 }),
])
const everyQuest: QuestDoc[] = towns.flatMap((town) => [...town.quests])
const everyStep = everyQuest.flatMap((quest) => quest.steps)
const some = (wanted: (quest: QuestDoc) => boolean) => everyQuest.filter(wanted).length

describe('generated quests', () => {
  it('writes the same quests twice for one seed', async () => {
    const [a, b] = await Promise.all([buildTown('quest-seed'), buildTown('quest-seed')])
    expect(digest(a.quests)).toBe(digest(b.quests))
  })

  it('writes different quests for a different seed or a different theme', async () => {
    const [a, other, coastal] = await Promise.all([
      buildTown('quest-seed'),
      buildTown('quest-seed-two'),
      buildTown('quest-seed', { theme: 'quiet coastal town' }),
    ])
    expect(digest(a.quests)).not.toBe(digest(other.quests))
    expect(digest(a.quests)).not.toBe(digest(coastal.quests))
  })

  it('writes several shapes of job, not one template over and over', () => {
    const shapes = new Set(everyQuest.map((quest) => quest.steps.map((step) => step.kind).join('>')))
    expect(shapes.size).toBeGreaterThanOrEqual(5)
    expect(everyQuest.length).toBeGreaterThan(30)
  })

  it('uses what the quest engine offers: escorts, choices, counts, secrets and ways to fail', () => {
    expect(some((q) => q.steps.some((s) => s.kind === 'escort'))).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.kind === 'choice'))).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.kind === 'join'))).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.kind === 'stash'))).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.optional))).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.hidden))).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => (s.kind === 'collect' || s.kind === 'deliver') && (s.count ?? 1) > 1))).toBeGreaterThan(0)
    expect(some((q) => q.failWhen?.some((f) => f.kind === 'time-limit') ?? false)).toBeGreaterThan(0)
    expect(some((q) => q.failWhen?.some((f) => f.kind === 'npc-lost') ?? false)).toBeGreaterThan(0)
    expect(some((q) => q.failWhen?.some((f) => f.kind === 'item-lost') ?? false)).toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.effects.some((e) => e.kind === 'pay')))).toBeGreaterThan(0)

    // a hidden step is worth nothing to a player who cannot see where it is
    for (const step of everyStep) {
      if (step.kind === 'complete' || step.kind === 'join' || step.kind === 'choice') continue
      expect(step.markerLabel, step.objective).toBeDefined()
    }
    expect(everyStep.filter((step) => step.hint).length).toBeGreaterThan(everyQuest.length / 2)
  })

  it('never opens a quest by sending the player back to the person handing it out', () => {
    for (const quest of everyQuest) {
      const first = quest.steps.find((step) => step.id === quest.startStepId)!
      expect(first.kind === 'talk' && first.npcId === quest.giverNpcId, quest.title).toBe(false)
    }
  })

  it('pays what the work is worth, and not the same for every job', () => {
    const byBand = new Map<string, number[]>()
    for (const quest of everyQuest) {
      const band = quest.difficulty ?? 'small'
      expect(REWARD_TABLE[band].money.min).toBeLessThanOrEqual(quest.reward.money)
      expect(REWARD_TABLE[band].money.max).toBeGreaterThanOrEqual(quest.reward.money)
      byBand.set(band, [...(byBand.get(band) ?? []), quest.reward.money])
    }
    expect(byBand.size).toBeGreaterThanOrEqual(3)

    // the widest band pays a spread, not one number
    const widest = [...byBand.values()].sort((a, b) => b.length - a.length)[0]!
    expect(new Set(widest).size).toBeGreaterThan(5)

    // and a harder band always pays better than an easier one
    const order = ['errand', 'small', 'standard', 'hard', 'epic'].filter((band) => byBand.has(band))
    const lowest = order.map((band) => Math.min(...byBand.get(band)!))
    expect([...lowest].sort((a, b) => a - b)).toEqual(lowest)
  })

  it('holds most of the town back behind a main line that means something', () => {
    for (const { quests } of towns) {
      const main = quests.filter((quest) => quest.kind === 'main')
      expect(main.length).toBeGreaterThan(0)
      expect(main[0]!.requires ?? []).toEqual([])
      // each link waits on the one before it, and every gate is a flag the main line raises
      const raised = new Set(
        quests.flatMap((quest) => quest.steps.flatMap((step) => step.effects.filter((e) => e.kind === 'set-flag').map((e) => e.flag))),
      )
      for (const quest of quests) {
        for (const need of quest.requires ?? []) {
          expect(need.kind).toBe('flag')
          if (need.kind === 'flag') expect(raised.has(need.flag), `${quest.title} waits on ${need.flag}`).toBe(true)
        }
      }
      for (const [index, link] of main.slice(1).entries()) {
        expect(link.requires?.length, link.title).toBe(1)
        expect(main[index]!.steps.some((step) => step.effects.some((e) => e.kind === 'set-flag'))).toBe(true)
      }
    }
  })

  it('offers a player who has done nothing a handful of jobs, and more as the main line lands', () => {
    for (const { world, quests } of towns) {
      if (quests.length < 6) continue
      const player = PlayerState.create(world.id)
      const log = QuestLog.create(quests, player)
      const givers = [...new Set(quests.map((quest) => quest.giverNpcId))]
      const onTheBoard = () => givers.reduce((total, giver) => total + log.offeredBy(giver).length, 0)

      // most of the town is behind the main line, and side work is part of what waits
      const atFirst = onTheBoard()
      expect(atFirst).toBeGreaterThan(0)
      expect(atFirst).toBeLessThanOrEqual(Math.ceil(quests.length * 0.6))
      expect(quests.filter((quest) => quest.kind === 'side' && (quest.requires?.length ?? 0) > 0).length).toBeGreaterThan(0)

      player.setFlag('standing_1', true)
      expect(onTheBoard()).toBeGreaterThan(atFirst)
    }
  })

  it('writes nothing the quest engine will not take, and nothing that cannot be finished', () => {
    for (const town of towns) {
      expect(town.rejected).toEqual([])
      for (const quest of town.quests) {
        // both ways round, so a choice is proved on either branch
        for (const choose of [() => 0, () => 1]) {
          const player = PlayerState.create(town.world.id)
          for (const need of quest.requires ?? []) if (need.kind === 'flag') player.setFlag(need.flag, need.value)
          const log = QuestLog.create(town.quests, player)
          expect(log.start(quest.id).ok, quest.title).toBe(true)
          expect(playThrough(quest, log, player, choose), `${quest.title} (${quest.steps.map((s) => s.kind).join('>')})`).toBe('complete')
          expect(player.money).toBeGreaterThan(0)
        }
      }
    }
  })

  it('gives a timed job longer than the walk it asks for, on the clock the game runs', () => {
    const walk = 100
    const clock = PlayerState.create('world_0001').clock
    const before = clock.totalSeconds
    clock.advance(walk / METRICS.player.walkSpeed)
    expect(clock.totalSeconds - before).toBeLessThan(secondsToWalk(walk))
  })
})

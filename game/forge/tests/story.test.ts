import { PlayerState } from '@gb/play'
import { QuestLog, type QuestDoc } from '@gb/quest'
import type { World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { ownedItems, Player, type Choose } from './player.ts'
import { buildTown } from './support.ts'

/** Every flag a quest of this town can raise. */
const marksIn = (quests: readonly QuestDoc[]): Set<string> =>
  new Set(quests.flatMap((q) => q.steps.flatMap((s) => s.effects.filter((e) => e.kind === 'set-flag').map((e) => e.flag))))

/** The rung a link puts the player on. */
const rungOf = (quest: QuestDoc): number =>
  Math.max(
    0,
    ...quest.steps.flatMap((s) => s.effects.filter((e) => e.kind === 'set-flag').map((e) => Number(/^standing_(\d+)$/.exec(e.flag)?.[1] ?? 0))),
  )

/** What the player is left holding when there is nothing else in town to do. */
interface Ending {
  readonly finished: string[]
  readonly marks: string[]
  readonly standing: number
  readonly money: number
  readonly standings: Array<[string, number]>
  /** How many times the player had a choice of what to do next. */
  readonly boards: number[]
  /** Work the town offered that no verb the game has can finish, by step kind. */
  readonly unfinishable: string[]
}

/**
 * Plays a whole town the way somebody would: take whatever is on offer, finish
 * it, see what that opened, and keep going until the town has nothing left.
 */
function playTown(world: World, quests: readonly QuestDoc[], choose: Choose): Ending {
  const state = PlayerState.create(world.id, 200)
  const log = QuestLog.create(quests, state)
  const player = new Player(log, state, { owned: ownedItems(world), choose })
  const givers = [...new Set(quests.map((quest) => quest.giverNpcId))]
  const finished: string[] = []
  const boards: number[] = []
  const unfinishable = new Set<string>()

  for (let round = 0; round < quests.length + 5; round++) {
    const offered = givers.flatMap((giver) => log.offeredBy(giver))
    boards.push(offered.length)
    if (!offered.length) break
    for (const quest of offered) {
      if (!log.start(quest.id).ok) continue
      const run = player.play(quest)
      for (const block of run.blocked) unfinishable.add(block.kind)
      if (run.status === 'complete') finished.push(quest.id)
    }
  }

  const marks = [...marksIn(quests)].filter((flag) => state.flag(flag)).sort()
  return {
    finished: finished.sort(),
    marks,
    standing: Math.max(0, ...marks.map((flag) => Number(/^standing_(\d+)$/.exec(flag)?.[1] ?? 0))),
    money: state.money,
    standings: [...new Set(quests.map((quest) => quest.reward.faction))].map((faction) => [faction, state.reputation(faction)] as [string, number]).sort(),
    boards,
    unfinishable: [...unfinishable].sort(),
  }
}

/** The two branches of a forked line: links at one rung gated on opposite marks. */
function forkOf(quests: readonly QuestDoc[]): { rung: number; sides: QuestDoc[] } | undefined {
  const main = quests.filter((quest) => quest.kind === 'main')
  for (const rung of new Set(main.map(rungOf))) {
    const sides = main.filter((quest) => rungOf(quest) === rung)
    if (sides.length === 2 && sides.every((quest) => quest.requires?.some((need) => need.kind === 'flag' && need.flag.startsWith('allied:')))) {
      return { rung, sides }
    }
  }
  return undefined
}

const [town, city, hamlet] = await Promise.all([
  buildTown('story-town', { blocksX: 5, blocksY: 5 }),
  buildTown('story-city', { blocksX: 8, blocksY: 8, theme: 'dense neon port city' }),
  // too small to have two sides: its line is the one it always was, and it still finishes
  buildTown('story-hamlet', { blocksX: 2, blocksY: 2 }),
])

describe('a town that remembers what the player did', () => {
  it('leaves a mark on the world every time the player is made to choose', () => {
    let choices = 0
    for (const built of [town, city]) {
      const plots = new Set(built.world.plots().map((plot) => plot.id))
      const people = new Set(built.world.npcs().map((npc) => npc.id))
      for (const quest of built.quests) {
        const byId = new Map(quest.steps.map((step) => [step.id, step]))
        for (const step of quest.steps) {
          if (step.kind !== 'choice') continue
          choices++
          for (const option of step.options) {
            const taken = byId.get(option.next)!
            const marks = taken.effects.filter((effect) => effect.kind === 'set-flag')
            expect(marks.length, `${quest.title}: taking "${option.label}" changes nothing but a number`).toBeGreaterThan(0)
            for (const { flag } of marks) {
              const [kind, subject] = flag.split(':')
              expect(['sided', 'crossed', 'owed', 'allied'], `${quest.title}: ${flag}`).toContain(kind)
              expect(plots.has(subject!) || people.has(subject!), `${flag} names nobody in this town`).toBe(true)
            }
          }
        }
      }
    }
    expect(choices).toBeGreaterThan(2)
  })

  it('splits the main line in two, in two parts of town, behind two different counters', () => {
    for (const built of [town, city]) {
      const fork = forkOf(built.quests)
      expect(fork, `${built.world.name} never makes the player pick a side`).toBeDefined()
      if (!fork) continue
      const [one, two] = fork.sides
      expect(one!.giverNpcId).not.toBe(two!.giverNpcId)

      const marks = fork.sides.map((quest) => quest.requires!.find((need) => need.kind === 'flag' && need.flag.startsWith('allied:'))!)
      expect(marks[0]).not.toEqual(marks[1])
      // and the link before the fork is what raises both of them
      const raised = marksIn(built.quests.filter((quest) => rungOf(quest) === fork.rung - 1))
      for (const need of marks) expect(raised.has((need as { flag: string }).flag), `nothing offers ${(need as { flag: string }).flag}`).toBe(true)
    }
  })

  it('ends the same town somewhere different depending on which side the player took', () => {
    for (const built of [town, city]) {
      const one = playTown(built.world, built.quests, () => 0)
      const two = playTown(built.world, built.quests, () => 1)

      expect(one.marks, `${built.world.name} remembers the same thing either way`).not.toEqual(two.marks)
      expect(one.finished, `${built.world.name} plays out the same either way`).not.toEqual(two.finished)
      expect(one.standings).not.toEqual(two.standings)

      // and the two sides are actually exclusive: nobody ends up allied with both
      for (const ending of [one, two]) {
        expect(ending.marks.filter((flag) => flag.startsWith('allied:')).length, 'allied with both sides at once').toBeLessThanOrEqual(1)
      }
      const allied = [one, two].map((ending) => ending.marks.filter((flag) => flag.startsWith('allied:')))
      expect(allied[0]).not.toEqual(allied[1])
    }
  })

  it('pays standing with the place the work was for, not with the town at large', () => {
    for (const built of [town, city]) {
      const home = new Map<string, string>()
      for (const interior of built.world.interiors()) {
        for (const npc of built.world.npcs()) if (npc.station?.interiorId === interior.id) home.set(npc.id, interior.plotId)
      }
      const parties = new Set<string>()
      for (const quest of built.quests) {
        expect(quest.reward.faction, `${quest.title} pays standing with nobody in particular`).toBe(home.get(quest.giverNpcId))
        parties.add(quest.reward.faction)
      }
      // and a town has several of them, or standing is one number again
      expect(parties.size, `${built.world.name} has one faction`).toBeGreaterThan(3)
    }
  })

  it('never strands the player, whichever side they take', () => {
    for (const built of [town, city, hamlet]) {
      const top = Math.max(...built.quests.filter((quest) => quest.kind === 'main').map(rungOf))
      for (const choose of [() => 0, () => 1] as Choose[]) {
        const ending = playTown(built.world, built.quests, choose)
        expect(ending.standing, `${built.world.name}: the main line stops short`).toBe(top)
        // there was always something to do until there was nothing left to do
        expect(ending.boards.at(-1)).toBe(0)
        expect(ending.boards.slice(0, -1).every((many) => many > 0), 'the town went quiet with work still in it').toBe(true)
        expect(
          ending.finished.length,
          `${built.world.name} left work nobody can finish today: ${ending.unfinishable.join(', ') || 'none'}`,
        ).toBeGreaterThan(built.quests.length / 3)
      }
    }
  })

  it('has somebody with work behind a good share of the doors a fresh player can open', () => {
    // the gate is only as good as the number of ungated people a player can walk
    // in on, and they can only walk in on the doors that open
    for (const built of [town, city, hamlet]) {
      const home = new Map(
        built.world.interiors().flatMap((interior) =>
          built.world
            .npcs()
            .filter((npc) => npc.station?.interiorId === interior.id)
            .map((npc) => [npc.id, interior.plotId] as const),
        ),
      )
      const player = PlayerState.create(built.world.id, 200)
      const log = QuestLog.create(built.quests, player)
      const givers = [...new Set(built.quests.map((quest) => quest.giverNpcId))]
      const offering = new Set(givers.flatMap((giver) => log.offeredBy(giver)).map((quest) => home.get(quest.giverNpcId)))
      const doors = built.world.interiors().length
      expect(offering.size / doors, `${built.world.name} opens ${doors} doors with work behind ${offering.size}`).toBeGreaterThan(0.25)
      // and it is spread over the doors rather than stacked on a few counters.
      // The hamlet is left out: three doors and four jobs is somebody with two
      // of them whatever the writer prefers
      if (built === hamlet) continue
      const holding = new Set(built.quests.map((quest) => home.get(quest.giverNpcId)))
      expect(built.quests.length / holding.size, `${built.world.name} stacks its work on ${holding.size} counters`).toBeLessThan(1.4)
    }
  })

  it('stops offering work at a place the player crossed, and keeps offering it everywhere else', () => {
    const { world, quests } = city
    const crossings = quests.flatMap((quest) => quest.requires ?? []).filter((need) => need.kind === 'flag' && need.flag.startsWith('crossed:'))
    expect(crossings.length, 'nobody in town minds being crossed').toBeGreaterThan(0)
    for (const need of crossings) expect(need.kind === 'flag' && need.value).toBe(false)

    const shut = (crossings[0] as { flag: string }).flag
    const givers = [...new Set(quests.map((quest) => quest.giverNpcId))]
    const board = (set: boolean) => {
      const player = PlayerState.create(world.id)
      player.setFlag(shut, set)
      const log = QuestLog.create(quests, player)
      return givers.flatMap((giver) => log.offeredBy(giver)).map((quest) => quest.id)
    }
    const before = board(false)
    const after = board(true)
    expect(after.length, `crossing ${shut} costs the player nothing`).toBeLessThan(before.length)
    expect(after.length, 'crossing one place empties the whole board').toBeGreaterThan(0)
  })
})

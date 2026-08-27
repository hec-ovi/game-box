import { PlayerState } from '@gb/play'
import { QuestLog, REWARD_TABLE, type QuestDoc } from '@gb/quest'
import { METRICS, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { secondsFor } from '../src/quests/pace.ts'
import { buildTold, LOCKUP } from './histories.ts'
import { across, line, playEvery } from './playable.ts'
import { buildTown, digest } from './support.ts'

/** A handful of towns, built once, that the measurements below all read. */
const towns = await Promise.all([
  buildTown('recipes-1'),
  buildTown('recipes-2'),
  buildTown('recipes-3', { theme: 'dense neon port city' }),
  buildTown('recipes-4', { theme: 'quiet coastal town' }),
  buildTown('recipes-5', { theme: 'farming village on the plains', blocksX: 4, blocksY: 3 }),
  buildTown('recipes-6', { theme: 'cold industrial rail town', blocksX: 2, blocksY: 2 }),
  buildTown('recipes-7', { theme: 'snowy alpine ski town', blocksX: 3, blocksY: 3 }),
  buildTown('recipes-8', { theme: 'dense neon port city', blocksX: 4, blocksY: 4 }),
  buildTold('recipes-9', LOCKUP),
  // one town briefed wide: a city of three places rarely opens a bench to hand a car over
  buildTown('recipes-10', { theme: 'cold industrial rail town', blocksX: 5, blocksY: 5, openPlaces: 12 }),
])
const everyQuest: QuestDoc[] = towns.flatMap((town) => [...town.quests])
/** Every one of them played through, once per road, by somebody with the verbs the game has. */
const played = towns.map((town) => playEvery(town.world, town.quests))
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

    // and the locks, the screens and the counters the second wave put in the town
    expect(some((q) => q.steps.some((s) => s.kind === 'unlock')), 'nothing gets the player through a door').toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.kind === 'hack')), 'nothing opens a screen').toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.kind === 'beat-game')), 'nothing bets on a game').toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.kind === 'buy')), 'nothing is bought over a counter').toBeGreaterThan(0)
    expect(some((q) => q.steps.some((s) => s.effects.some((e) => e.kind === 'give-item' || e.kind === 'give-password'))), 'no way past a lock is ever handed out').toBeGreaterThan(0)
    expect(some((q) => (q.reward.access?.length ?? 0) > 0), 'no job leaves a door open to the player').toBeGreaterThan(0)
    expect(some((q) => q.reward.car !== undefined), 'no job pays a car').toBeGreaterThan(0)
    expect(some((q) => q.reward.deed !== undefined), 'no job pays a home').toBeGreaterThan(0)
    // a way past a lock is handed out before the lock, a code before the screen, and only where the town wrote one
    for (const quest of everyQuest) {
      for (const step of quest.steps) {
        if (step.kind !== 'unlock' && step.kind !== 'hack') continue
        const before = quest.steps.filter((other) => other.next.includes(step.id))
        expect(before.some((other) => other.effects.some((e) => e.kind === 'give-item' || e.kind === 'give-password')), `${quest.title} sends the player to a lock with nothing to open it`).toBe(true)
      }
    }

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
      // a car and a home only from the bands that may pay them, and only the top of the main line pays either
      if (quest.reward.car) expect(REWARD_TABLE[band].car, `${quest.title} pays a car for ${band} work`).toBe(true)
      if (quest.reward.deed) expect(REWARD_TABLE[band].deed, `${quest.title} pays a home for ${band} work`).toBe(true)
      if (quest.reward.car || quest.reward.deed) expect(quest.kind).toBe('main')
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
          // a job waits on a mark, or on the money a shopping list costs
          expect(['flag', 'money-at-least']).toContain(need.kind)
          // waiting for something to have happened means the town can make it happen;
          // waiting for something not to have happened needs nothing, because a mark
          // the player never earns simply stays down
          if (need.kind === 'flag' && need.value) expect(raised.has(need.flag), `${quest.title} waits on ${need.flag}`).toBe(true)
          if (need.kind === 'money-at-least') expect(quest.steps.some((step) => step.kind === 'buy'), `${quest.title} wants money and buys nothing`).toBe(true)
        }
      }
      for (const link of main.slice(1)) {
        const needs = link.requires ?? []
        expect(needs.length, link.title).toBeGreaterThanOrEqual(1)
        expect(needs.every((need) => need.kind === 'flag' && need.value), link.title).toBe(true)
      }
      for (const link of main) {
        expect(link.steps.some((step) => step.effects.some((e) => e.kind === 'set-flag')), link.title).toBe(true)
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
      // three quarters of the side work is up front and the rest waits on the ladder
      expect(atFirst).toBeLessThanOrEqual(Math.ceil(quests.length * 0.75))
      expect(quests.filter((quest) => quest.kind === 'side' && (quest.requires?.length ?? 0) > 0).length).toBeGreaterThan(0)

      player.setFlag('standing_1', true)
      expect(onTheBoard()).toBeGreaterThan(atFirst)
    }
  })

  it('writes nothing the quest engine will not take, and nothing that dead-ends on its own', () => {
    // a quest can stop today because the game has no verb for one of its steps.
    // It may never stop for any other reason: that would be this box writing a
    // job nobody can finish, whatever else ships
    for (const [at, town] of towns.entries()) {
      expect(town.rejected).toEqual([])
      const report = played[at]!
      expect(
        report.stranded.map((run) => `${run.title} [${run.status}] stuck at ${run.stranded.join(', ')}`),
        `${town.world.name} wrote work that stops for a reason nobody owes`,
      ).toEqual([])
      for (const run of report.runs) if (run.completable) expect(run.paid, `${run.title} finished and paid nothing`).toBeGreaterThan(0)
    }
  })

  it('writes work a player can finish today, every job of it', () => {
    // the figure worth quoting about this box: every generated quest, driven
    // through the verbs the running game gives a player and no others
    const report = across(played)
    expect(report.quests, 'too few jobs to read anything off').toBeGreaterThan(30)
    expect(report.completable, line(report)).toBe(report.quests)
  })

  it('ends a job in front of the person who handed it out', () => {
    // go there, do the thing, come back. A `complete` step resolves the moment
    // it opens and is never on the board, so the last thing the player is asked
    // for has to be the hand-in, or the job just stops wherever they are
    for (const quest of everyQuest) {
      const ends = new Set(quest.steps.filter((step) => step.kind === 'complete').map((step) => step.id))
      const closing = quest.steps.filter((step) => (step.next ?? []).some((id) => ends.has(id)))
      expect(closing.length, `${quest.title} has no way into its ending`).toBeGreaterThan(0)
      for (const step of closing) {
        const facing = step.kind === 'talk' ? step.npcId : step.kind === 'deliver' ? step.toNpcId : undefined
        // unless taking that road crossed them, which is the whole point of a road that does
        const crossing = step.effects.some((effect) => effect.kind === 'set-flag' && effect.flag.startsWith('crossed:'))
        expect(facing === quest.giverNpcId || crossing, `${quest.title} ends on a ${step.kind} away from ${quest.giverNpcId}`).toBe(true)
      }
    }
  })

  it('gives a timed job the hour the clock needs, and more for every walk and every reply', () => {
    // @gb/quest's own budget at 24 game seconds a real second: 600 a
    // conversation, 3000 a walk, nothing under 3600, and a real walk at
    // walking pace when it is longer than that
    const clock = PlayerState.create('world_0001').clock
    expect(clock.rate).toBe(24)
    expect(secondsFor({ metres: 0, legs: 0, talks: 0 })).toBe(3600)
    expect(secondsFor({ metres: 100, legs: 1, talks: 1 })).toBeGreaterThanOrEqual(3600 + 600)
    const far = 1000
    const before = clock.totalSeconds
    clock.advance(far / METRICS.player.walkSpeed)
    expect(secondsFor({ metres: far, legs: 1, talks: 0 })).toBeGreaterThan(clock.totalSeconds - before)
    expect(secondsFor({ metres: 1e6, legs: 9, talks: 9 })).toBe(86400)
    for (const quest of everyQuest) {
      for (const rule of quest.failWhen ?? []) if (rule.kind === 'time-limit') expect(rule.seconds, quest.title).toBeGreaterThanOrEqual(3600)
    }
  })
})

/**
 * Where one line of a quest sends the player, and who it names when it gets
 * there. Read straight off the step, the way the interface reads it: what the
 * marker on the map points at, and whose name is in the sentence.
 */
function pointsAt(step: QuestDoc['steps'][number], world: World): { plotId: string | undefined; names: string[] } {
  const plotOfNpc = (npcId: string): string | undefined => {
    const station = world.npc(npcId)?.station
    return station ? world.interior(station.interiorId)?.plotId : undefined
  }
  const plotOfItem = (itemId: string): string | undefined => {
    const placement = world.placements().find((one) => one.itemId === itemId)
    if (!placement) return undefined
    if (placement.at === 'anchor') return world.interior(placement.interiorId)?.plotId
    return placement.at === 'npc' ? plotOfNpc(placement.npcId) : undefined
  }
  const plotOf = (place: { plotId: string } | { interiorId: string }): string | undefined =>
    'plotId' in place ? place.plotId : world.interior(place.interiorId)?.plotId

  switch (step.kind) {
    case 'talk':
      return { plotId: plotOfNpc(step.npcId), names: [step.npcId] }
    case 'deliver':
      return { plotId: plotOfNpc(step.toNpcId), names: [step.toNpcId] }
    case 'collect':
    case 'buy':
      return { plotId: plotOfItem(step.itemId), names: [] }
    case 'stash':
      return { plotId: world.interior(step.interiorId)?.plotId, names: [] }
    case 'goto':
      return { plotId: plotOf(step.place), names: [] }
    // the marker on an escort is where the two of them are walking to; the
    // companion was found at an earlier step, which is checked below
    case 'escort':
      return { plotId: plotOf(step.place), names: [] }
    case 'unlock':
      return { plotId: world.interior(world.door(step.doorId)?.interiorId ?? '')?.plotId, names: [] }
    case 'hack':
    case 'beat-game':
      return { plotId: world.interior(world.machine(step.machineId)?.interiorId ?? '')?.plotId, names: [] }
    default:
      return { plotId: undefined, names: [] }
  }
}

describe('the people a quest names', () => {
  it('names nothing that is not in the world', () => {
    // measured against the local model: offered three people by id, it answered
    // with a fourth that was never in the town. Every id in a shipped quest has
    // to resolve, or the map points at a place where nobody by that name stands
    let ids = 0
    for (const town of towns) {
      for (const quest of town.quests) {
        for (const id of idsIn(quest)) {
          ids++
          expect(resolves(town.world, id), `${quest.title} names ${id}, which is nothing in ${town.world.name}`).toBe(true)
        }
      }
    }
    expect(ids, 'no quest in any of these towns names anything').toBeGreaterThan(100)
  })

  it('never names somebody who is not standing in the place the step points at', () => {
    // the reason the work is written before anybody is. A quest written over a
    // town that is already full can say "talk to John" and drop a marker on a
    // building with five strangers in it; a quest written first has its people
    // written to it, so this cannot happen
    let checked = 0
    for (const town of towns) {
      const { world } = town
      for (const quest of town.quests) {
        for (const step of quest.steps) {
          const { plotId, names } = pointsAt(step, world)
          if (step.kind !== 'complete' && step.kind !== 'join' && step.kind !== 'choice') {
            expect(plotId, `${quest.title}: its ${step.kind} points at nowhere in town`).toBeDefined()
            const plot = world.plot(plotId!)!
            // the marker over the map says which building it is
            expect(clipped(plot.name), `${quest.title}: "${step.objective}" marks ${step.markerLabel} and points at ${plot.name}`).toBe(step.markerLabel)
          }
          for (const npcId of names) {
            const npc = world.npc(npcId)
            expect(npc, `${quest.title}: "${step.objective}" names ${npcId}, who is nobody`).toBeDefined()
            expect(npc!.station, `${quest.title}: ${npc!.name} stands nowhere`).toBeDefined()
            expect(world.interior(npc!.station!.interiorId)?.plotId, `${quest.title}: "${step.objective}" sends the player to ${world.plot(plotId!)!.name}, and ${npc!.name} is not in it`).toBe(plotId)
            expect(step.objective, `${quest.title}: "${step.objective}" points at ${npc!.name} without saying their name`).toContain(npc!.name)
            checked++
          }
        }
      }
    }
    expect(checked, 'no quest in any of these towns names anybody').toBeGreaterThan(30)
  })

  it('walks a companion off a step that found them where they were standing', () => {
    // an escort is the one line whose marker is not where its person is, because
    // the two of them are walking. The step that picked them up has to be
    // honest, or nobody is ever found
    let escorts = 0
    for (const town of towns) {
      const { world } = town
      for (const quest of town.quests) {
        for (const step of quest.steps) {
          if (step.kind !== 'escort') continue
          escorts++
          const found = quest.steps.find((other) => other.kind === 'talk' && other.npcId === step.npcId)
          expect(found, `${quest.title} asks the player to walk somebody they were never sent to find`).toBeDefined()
          const home = world.interior(world.npc(step.npcId)!.station!.interiorId)!.plotId
          expect(found!.markerLabel).toBe(clipped(world.plot(home)!.name))
        }
      }
    }
    expect(escorts, 'nobody in any of these towns is walked anywhere').toBeGreaterThan(0)
  })

  it('names every person and every place off the town, never off the architecture it was written against', () => {
    // the work is written under placeholders (Person 3 at Instance 7) and bound
    // to the names the story wrote. A placeholder left in a line is a line the
    // player reads as a spreadsheet
    for (const town of towns) {
      for (const quest of town.quests) {
        expect(JSON.stringify(quest), `${quest.title} still reads off the blueprint`).not.toMatch(/\b(Zone|Instance|Person|Thing) \d+\b/i)
      }
    }
  })
})

/** A marker is capped shorter than a place name, so a long sign is clipped where it is bound. */
const clipped = (name: string): string => (name.length <= 40 ? name : `${name.slice(0, 39).trimEnd()}.`)

/** Every id a quest names, wherever in the document it is written. */
function idsIn(quest: QuestDoc): Set<string> {
  return new Set(JSON.stringify(quest).match(/\b(?:npc|item|plot|interior|anchor|door|machine)_\d+\b/g) ?? [])
}

/** Whether the city holds the thing an id names. */
function resolves(world: World, id: string): boolean {
  const [kind] = id.split('_')
  switch (kind) {
    case 'npc':
      return world.npc(id) !== undefined
    case 'item':
      return world.item(id) !== undefined
    case 'plot':
      return world.plot(id) !== undefined
    case 'interior':
      return world.interior(id) !== undefined
    case 'door':
      return world.door(id) !== undefined
    case 'machine':
      return world.machine(id) !== undefined
    case 'anchor':
      return world.interiors().some((interior) => interior.anchors.some((anchor) => anchor.id === id))
    default:
      return false
  }
}

import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest, type QuestDoc, type WorldView } from '../src/index.ts'

export const MARA = 'npc_0001'
export const HOLLIS = 'npc_0002'
export const WITNESS = 'npc_0003'
/** Five interchangeable crates: what "three of five" is counted over. */
export const CRATES = ['item_0001', 'item_0002', 'item_0003', 'item_0004', 'item_0005'] as const
export const LEDGER = 'item_0006'
/** The warehouse's locked back door and the terminal on its desk. */
export const BACK_DOOR = 'door_0001'
export const TERMINAL = 'machine_0001'

const NPCS = new Set([MARA, HOLLIS, WITNESS])
const ITEMS = new Set<string>([...CRATES, LEDGER])

/** A warehouse with a locked back door and a terminal, three people, five crates and a ledger. */
export const world: WorldView = {
  hasNpc: (id) => NPCS.has(id),
  hasPlot: (id) => id === 'plot_0001',
  hasInterior: (id) => id === 'interior_0001',
  hasItem: (id) => ITEMS.has(id),
  hasAnchor: (interiorId, anchorId) => interiorId === 'interior_0001' && anchorId === 'anchor_0001',
  hasDoor: (id) => id === BACK_DOOR,
  hasMachine: (id) => id === TERMINAL,
}

/** A quest as an author writes it: the envelope is not theirs to fill in. */
export function draft(steps: readonly object[], overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'quest_0001',
    kind: 'side',
    title: 'The Missing Ledger',
    summary: 'Mara wants what Hollis keeps in the warehouse.',
    giverNpcId: MARA,
    startStepId: (steps[0] as { id: string }).id,
    steps,
    reward: rewardFor('small'),
    ...overrides,
  }
}

/**
 * A quest as a generator would hand it over: untrusted JSON, no envelope
 * assumptions, so every test goes in through the same door the model does.
 */
export function quest(steps: readonly object[], overrides: Record<string, unknown> = {}): unknown {
  return { format: 'game-box.quest', schemaVersion: 1, ...(draft(steps, overrides) as object) }
}

export function accept(candidate: unknown): QuestDoc {
  const result = validateQuest(candidate, world)
  if (!result.ok) throw new Error(`the fixture was refused: ${JSON.stringify(result.error)}`)
  return result.value
}

/** The error code and every complaint, whichever kind of refusal it was. */
export function refusal(candidate: unknown): { code: string; messages: string[] } {
  const result = validateQuest(candidate, world)
  if (result.ok) return { code: 'accepted', messages: [] }
  if (result.error.code === 'broken-flow') {
    return { code: result.error.code, messages: result.error.problems.map((p) => p.message) }
  }
  return { code: result.error.code, messages: result.error.violations.map((v) => `${v.path}: ${v.message}`) }
}

export function play(candidate: unknown, startingMoney = 0): { log: QuestLog; player: PlayerState } {
  const player = PlayerState.create('world_0001', startingMoney)
  return { log: QuestLog.create([accept(candidate)], player), player }
}

export function texts(log: QuestLog): string[] {
  return log.objectives().map((objective) => objective.text).toSorted()
}

import type { Sent } from './fake-model.ts'

/** One errand as a writer hands it over: the story, in the order it happens. */
export function sheet(id: string, beats: readonly object[], extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: id === 'quest_0001' ? ('main' as const) : ('side' as const),
    title: `Errand ${id}`,
    summary: 'Somebody wants something moved.',
    giverNpcId: 'npc_0001',
    beats,
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
    ...extra,
  }
}

/** The fetch-and-carry every model answer in these tests boils down to, written about whoever the prompt offered. */
export function fetchAndCarry(call: Sent, extra: Record<string, unknown> = {}) {
  const id = /quest_\d{4}/.exec(call.user)?.[0] ?? 'quest_0001'
  const npcId = /npc_\d{4}/.exec(call.user)![0]!
  const itemId = /item_\d{4}/.exec(call.user)![0]!
  return sheet(
    id,
    [
      { kind: 'collect', itemId, objective: 'Take it' },
      { kind: 'deliver', itemId, toNpcId: npcId, objective: 'Hand it over' },
    ],
    { giverNpcId: npcId, ...extra },
  )
}

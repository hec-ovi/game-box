import type { SaveDoc } from '../schema.ts'
import type { Ledger } from './ledger.ts'
import type { Resolver } from './resolver.ts'

type PlayerDoc = SaveDoc['player']

/**
 * The player's record with everything this city cannot resolve taken out.
 * Money, flags, standing and the clock name nothing, so they pass untouched.
 */
export function reconcilePlayer(doc: PlayerDoc, resolve: Resolver, ledger: Ledger): PlayerDoc {
  const { where, tracked, moved, codex, memory, ...base } = doc
  const inventory = doc.inventory.filter((id) => ledger.judge('item', id, resolve.hasItem(id)))
  const carried = new Set(inventory)
  const keptWhere = where && (where.interiorId === undefined || ledger.judge('where', where.interiorId, resolve.hasInterior(where.interiorId))) ? where : undefined
  const keptTracked = tracked !== undefined && ledger.judge('tracked', tracked, resolve.hasQuest(tracked)) ? tracked : undefined
  return {
    ...base,
    inventory,
    stolen: doc.stolen.filter((id) => carried.has(id)),
    companions: doc.companions.filter((id) => ledger.judge('companion', id, resolve.hasNpc(id))),
    ...(keptWhere ? { where: keptWhere } : {}),
    ...(keptTracked ? { tracked: keptTracked } : {}),
    ...(moved ? { moved: moved.filter((one) => ledger.judge('placed', one.itemId, resolve.hasItem(one.itemId) && resolve.hasAnchor(one.interiorId, one.anchorId))) } : {}),
    ...(codex ? { codex: reconcileCodex(codex, resolve, ledger) } : {}),
    ...(memory ? { memory: Object.fromEntries(Object.entries(memory).filter(([id]) => ledger.judge('person', id, resolve.hasNpc(id)))) } : {}),
  }
}

function reconcileCodex(codex: NonNullable<PlayerDoc['codex']>, resolve: Resolver, ledger: Ledger): NonNullable<PlayerDoc['codex']> {
  return {
    places: codex.places.filter((id) => ledger.judge('place', id, resolve.hasInterior(id))),
    people: codex.people.filter((one) => ledger.judge('person', one.npcId, resolve.hasNpc(one.npcId))),
  }
}

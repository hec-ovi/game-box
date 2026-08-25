import type { Rng } from '@gb/kit'
import type { PlannedInside, PlannedSite, PlannedThing } from './planned.ts'

/** What a home costs before its floor is counted, and what every square metre of it adds. */
const BASE_PRICE = 300
const PER_METRE = 15

/** How far one home's price swings either side of that. */
const HAGGLE = 0.15

/**
 * Puts homes up for sale: every home that opens but one, so a town with one
 * home sells it and a bigger town keeps one lived in and sells the rest, each
 * a place with an open door and nobody living in it, its deed on the counter
 * of somewhere that keeps papers, priced by its floor. A town with nowhere to
 * buy a deed from sells nothing.
 */
export function putUpForSale(planned: readonly PlannedSite[], counts: { items: number }, rng: Rng): PlannedSite[] {
  const homes = planned.filter((one) => one.inside && one.charter.residential && one.charter.access === 'open')
  const sellers = planned.filter((one) => one.inside && !homes.includes(one) && counterOf(one.inside) !== undefined)
  const desks = sellers.filter((one) => one.charter.holding.includes('papers'))
  const wanted = homes.length ? Math.max(1, homes.length - 1) : 0
  if (!wanted || !sellers.length) return [...planned]

  const sold = new Map<PlannedSite, PlannedInside>()
  const deeds = new Map<PlannedSite, PlannedThing[]>()
  for (const [at, home] of rng.shuffle(homes).slice(0, wanted).entries()) {
    const seller = (desks.length ? desks : sellers)[at % (desks.length || sellers.length)]!
    const price = priceOf(home, rng)
    sold.set(home, { ...home.inside!, posts: [], forSale: price })
    deeds.set(seller, [
      ...(deeds.get(seller) ?? []),
      { thingId: `${seller.inside!.interiorId}/deed/${at}`, archetype: 'deed', anchorId: counterOf(seller.inside!)!, index: counts.items++, value: price, deedTo: home.inside!.interiorId },
    ])
  }
  return planned.map((one) => {
    const inside = sold.get(one)
    if (inside) return { ...one, inside }
    const added = deeds.get(one)
    return added ? { ...one, inside: { ...one.inside!, things: [...one.inside!.things, ...added] } } : one
  })
}

/** The counter a deed is sold over: the anchor of whoever serves there. */
const counterOf = (inside: PlannedInside): string | undefined => inside.plan.anchors.find((anchor) => anchor.kind === 'serve')?.id

/** Whole credits: the floor it stands on, storey by storey, moved by the seed. */
function priceOf(home: PlannedSite, rng: Rng): number {
  const floor = home.inside!.size.w * home.inside!.size.h * home.storeys
  return Math.round((BASE_PRICE + floor * PER_METRE) * rng.range(1 - HAGGLE, 1 + HAGGLE))
}

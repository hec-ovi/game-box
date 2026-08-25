import type { Holding } from '../model/traits.ts'
import type { ItemArchetype } from '../model/vocabulary.ts'

/**
 * What each class of holding is made of, in the shapes the game can place.
 * A charter names classes; whoever stocks a place draws from these. Every
 * archetype belongs to exactly one class.
 */
export const HOLDING_ARCHETYPES: Record<Holding, readonly ItemArchetype[]> = {
  goods: ['crate', 'box', 'parcel'],
  food: ['plate', 'cup'],
  drink: ['bottle', 'glass'],
  papers: ['book', 'ledger', 'envelope', 'keycard'],
  tools: ['toolbox', 'wrench', 'fuelcan'],
  valuables: ['cash', 'gem', 'painting', 'statue'],
  medicine: ['medkit'],
  personal: ['key', 'bag', 'briefcase', 'phone', 'radio', 'flower'],
}

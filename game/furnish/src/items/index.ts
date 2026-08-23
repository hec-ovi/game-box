import type { ItemArchetype } from '@gb/world'
import type { ItemBuilder } from './builder.ts'
import { bag, box, briefcase, crate, fuelcan, medkit, parcel, toolbox } from './pack.ts'
import { book, cash, envelope, keycard, ledger, painting } from './paper.ts'
import { gem, key, phone, radio, statue, wrench } from './tool.ts'
import { bottle, cup, flower, glass, plate } from './vessel.ts'

/** One builder per kind of thing a player can pick up. Nothing here is loaded from a file. */
export const ITEM_BUILDERS: Record<ItemArchetype, ItemBuilder> = {
  bottle,
  glass,
  crate,
  box,
  parcel,
  book,
  ledger,
  envelope,
  key,
  keycard,
  bag,
  briefcase,
  toolbox,
  wrench,
  painting,
  statue,
  phone,
  radio,
  plate,
  cup,
  cash,
  gem,
  flower,
  medkit,
  fuelcan,
}

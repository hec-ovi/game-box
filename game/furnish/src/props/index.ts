import type { FurnitureProp } from '@gb/world'
import { cabinet, crateStack, displayCase, fridge, shelf, wardrobe } from './case.ts'
import { barCounter, counter, sink, stove } from './counter.ts'
import { coffeeMachine, jukebox, lamp, register, tv } from './gear.ts'
import { plant, rug } from './green.ts'
import { barStool, chair, officeChair } from './seat.ts'
import { bed, sofa } from './soft.ts'
import { desk, table } from './table.ts'
import type { PropBuilder } from './builder.ts'

/** One builder per piece of furniture the generator can place. Nothing here is loaded from a file. */
export const BUILDERS: Record<FurnitureProp, PropBuilder> = {
  'bar-counter': barCounter,
  'bar-stool': barStool,
  table,
  chair,
  sofa,
  bed,
  desk,
  'office-chair': officeChair,
  shelf,
  cabinet,
  wardrobe,
  fridge,
  stove,
  sink,
  counter,
  register,
  'display-case': displayCase,
  'crate-stack': crateStack,
  plant,
  lamp,
  rug,
  tv,
  'coffee-machine': coffeeMachine,
  jukebox,
}

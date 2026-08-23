import { CourierChoice } from './courier-choice.ts'
import { ErrandPlus } from './errand-plus.ts'
import { EscortRun } from './escort.ts'
import { FetchRun } from './fetch.ts'
import { GatherRun } from './gather.ts'
import { HotParcel } from './hot-parcel.ts'
import type { Recipe } from './recipe.ts'
import { StashJob } from './stash-job.ts'
import { TipOff } from './tip-off.ts'
import { TwoHalves } from './two-halves.ts'

/** Every way this box knows of writing a quest out of a town. */
export const RECIPES: readonly Recipe[] = [
  new FetchRun(),
  new GatherRun(),
  new CourierChoice(),
  new EscortRun(),
  new ErrandPlus(),
  new TipOff(),
  new HotParcel(),
  new StashJob(),
  new TwoHalves(),
]

export type { Job, Recipe } from './recipe.ts'

import { CourierChoice } from './courier-choice.ts'
import { ErrandPlus } from './errand-plus.ts'
import { EscortRun } from './escort.ts'
import { FetchRun } from './fetch.ts'
import { GatherRun } from './gather.ts'
import { HackJob } from './hack-job.ts'
import { HighScore } from './high-score.ts'
import { HotParcel } from './hot-parcel.ts'
import { KeyRun } from './key-run.ts'
import type { Recipe } from './recipe.ts'
import { Shopping } from './shopping.ts'
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
  new KeyRun(),
  new HackJob(),
  new HighScore(),
  new Shopping(),
]

export type { Job, Recipe } from './recipe.ts'

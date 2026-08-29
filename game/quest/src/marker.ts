import type { Step } from './schema.ts'
import { markedId, targetOf } from './target.ts'
import type { WorldView } from './world-view.ts'

/**
 * What the schema takes for a `markerLabel`. A label written against a
 * placeholder grows when the real name is bound in later, and `@gb/forge` cuts
 * one back the same way when it does, so a name that is already long here
 * reads like one that grew long there.
 */
const CAP = 40

/**
 * The words beside a step's marker: the city's own name for the one thing that
 * step sends the player to.
 *
 * It is the name and nothing else, never a sentence composed here, because a
 * quest is compiled against the bare architecture where everything is still
 * "Instance 7" or "Person 3". Writing the placeholder is writing the real name:
 * `@gb/forge` swaps it for whatever that building or that person ended up being
 * called, along with the rest of the words the quest says.
 *
 * A city with no name for what the step points at gets no label at all.
 */
export function markerLabel(step: Step, world: WorldView): string | undefined {
  const id = markedId(targetOf(step))
  const name = id === undefined ? undefined : world.nameOf?.(id)?.trim()
  if (!name) return undefined
  return name.length > CAP ? `${name.slice(0, CAP - 1).trimEnd()}.` : name
}

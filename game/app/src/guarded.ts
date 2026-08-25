import { Greybox, type Dressing } from '@gb/scene'

/**
 * A dressing that cannot take the game down with it. If a piece of art fails to
 * build, the greybox answers for that one thing and the city carries on: a
 * broken pack is a duller street, never a blank screen.
 *
 * What a dressing answers only if it can is carried over when it has it: the
 * far look of a building, the light it throws onto the street, worn road paint
 * and its own rubbish. `@gb/scene` reads each by asking whether it is there, so
 * one dropped on the way through is a town dressed whole at every distance and
 * a city with no lights in it.
 */
export function guarded(dressing: Dressing, fallback: Dressing = new Greybox()): Dressing {
  const complained = new Set<string>()
  const guard = <T>(what: string, attempt: () => T, instead: () => T): T => {
    try {
      return attempt()
    } catch (cause) {
      if (!complained.has(what)) {
        complained.add(what)
        console.warn(`the art pack could not build ${what} (${String(cause)}); using blocks for those`)
      }
      return instead()
    }
  }

  const safe: Dressing = {
    building: (plot, size, charter) =>
      guard('buildings', () => dressing.building(plot, size, charter), () => fallback.building(plot, size, charter)),
    prop: (prop) => guard('furniture', () => dressing.prop(prop), () => fallback.prop(prop)),
    character: (npc, doing) => guard('people', () => dressing.character(npc, doing), () => fallback.character(npc, doing)),
    pickup: (item) => guard('things', () => dressing.pickup(item), () => fallback.pickup(item)),
    ground: (kind) => guard('the ground', () => dressing.ground(kind), () => fallback.ground(kind)),
    surface: (part, size) => guard('walls', () => dressing.surface(part, size), () => fallback.surface(part, size)),
  }

  const shell = dressing.shell?.bind(dressing)
  // a far building that will not build is drawn whole, which is what a dressing
  // with no shell at all gets
  if (shell) safe.shell = (plot, size, charter) => guard('far buildings', () => shell(plot, size, charter), () => fallback.building(plot, size, charter))

  const lights = dressing.lights?.bind(dressing)
  if (lights) safe.lights = (plot, size, charter) => guard('the light off buildings', () => lights(plot, size, charter), () => [])

  // paint and rubbish that will not build take the ground's own material: a
  // marking nobody can see is still a city, and there is nothing else on the
  // seam to fall back to
  const marking = dressing.marking?.bind(dressing)
  if (marking) safe.marking = (paint) => guard('road paint', () => marking(paint), () => fallback.marking?.(paint) ?? fallback.ground('street'))

  const clutter = dressing.clutter?.bind(dressing)
  if (clutter) safe.clutter = () => guard('rubbish', () => clutter(), () => fallback.clutter?.() ?? fallback.ground('sidewalk'))

  const bodies = (dressing as { members?: () => ReadonlyMap<string, unknown> }).members?.bind(dressing)
  return bodies ? Object.assign(safe, { members: bodies }) : safe
}

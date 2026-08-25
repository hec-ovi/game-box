import { Greybox, type Dressing } from '@gb/scene'
import type * as THREE from 'three'

/**
 * A dressing that cannot take the game down with it. If a piece of art fails to
 * build, the greybox answers for that one thing and the city carries on: a
 * broken pack is a duller street, never a blank screen.
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

  return {
    building: (plot, size, charter) =>
      guard('buildings', () => dressing.building(plot, size, charter), () => fallback.building(plot, size, charter)),
    prop: (prop) => guard('furniture', () => dressing.prop(prop), () => fallback.prop(prop)),
    character: (npc, doing) => guard('people', () => dressing.character(npc, doing), () => fallback.character(npc, doing)),
    pickup: (item) => guard('things', () => dressing.pickup(item), () => fallback.pickup(item)),
    ground: (kind) => guard('the ground', () => dressing.ground(kind), () => fallback.ground(kind)),
    surface: (part, size) => guard('walls', () => dressing.surface(part, size), () => fallback.surface(part, size)),
    ...('members' in dressing ? { members: (dressing as { members: () => unknown }).members.bind(dressing) } : {}),
  } as Dressing & Record<string, unknown>
}

/** A three.js object, for the type above. */
export type Built = THREE.Object3D

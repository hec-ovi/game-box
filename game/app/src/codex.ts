import type { CodexView } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { World } from '@gb/world'
import { storyNotes } from './story.ts'

/** A face already drawn for somebody, by id. Nothing for anyone the game has not drawn yet. */
export type FaceBook = (npcId: string) => string | undefined

/**
 * What the player has found out, in words. `@gb/play` keeps the record as ids
 * and which facts are earned; the names, the lines and the facts themselves
 * are the world file's. A fact's id is its place in the person's background,
 * counted from 0, which is how `@gb/talk` earns them. What the player was
 * told of the city is the History heading.
 */
export function codexOf(world: World, player: PlayerState, faces: FaceBook = () => undefined): CodexView {
  const found = player.discovered()
  return {
    places: found.places.flatMap((interiorId) => {
      const interior = world.interior(interiorId)
      const plot = interior ? world.plot(interior.plotId) : undefined
      if (!interior || !plot) return []
      const label = world.charter(interior.kind)?.label ?? interior.kind
      return [{ id: interiorId, name: plot.name, text: `A ${label}.` }]
    }),
    people: found.people.flatMap(({ npcId, unlocked }) => {
      const npc = world.npc(npcId)
      if (!npc) return []
      const earned = new Set(unlocked)
      const face = faces(npcId)
      return [
        {
          id: npcId,
          name: npc.name,
          role: npc.role.replace('-', ' '),
          disposition: player.disposition(npcId),
          ...(face ? { portrait: face } : {}),
          facts: (npc.background ?? []).map((fact, index) => {
            const id = String(index)
            return earned.has(id) ? { id, text: fact.fact } : { id }
          }),
        },
      ]
    }),
    history: storyNotes(player),
  }
}

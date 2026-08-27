import type { Interior, Npc } from '@gb/world'
import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { bands, fill, inBand, keyed } from './text.ts'

const WORDS = keyed(PROMPTS.surroundings)
const STANDING = bands(keyed(PROMPTS.standing))

type Anchor = Interior['anchors'][number]

/**
 * Where this person is and what they can see from there: the building, the
 * room and what stands in it, the spot they keep, who else is in, what the
 * player is carrying, the hour and the sky, and what the player's name in
 * town is worth. Everything is read off the world and the playthrough on the
 * call, never kept, so a conversation opened in a new building describes it.
 */
export class Scene {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** The building they are in, named the way the town names it. */
  get place(): string {
    return this.#plot()?.name ?? WORDS.outside!
  }

  /** The spot they keep, as an anchor kind. Nothing when they are not stationed. */
  get doing(): string | undefined {
    return this.#anchor(this.#npc())?.kind
  }

  get hour(): string {
    return this.#situation.player.clock.reading
  }

  get weather(): string {
    return WORDS[this.#situation.player.clock.weather] ?? ''
  }

  /** The room they keep a spot in and what stands in it. The street for somebody out walking. */
  room(): string {
    const interior = this.#interior(this.#npc())
    const anchor = this.#anchor(this.#npc())
    const room = interior?.rooms.find((candidate) => candidate.id === anchor?.roomId)
    if (!interior || !room) return WORDS.outside!
    const pieces = [...new Set(interior.furniture.filter((piece) => piece.roomId === room.id).map((piece) => piece.prop.replace(/-/g, ' ')))]
    const lying = this.#lyingIn(interior, room.id)
    const things = [pieces.join(', '), lying.length ? fill(WORDS.lying!, { items: lying.join(', ') }) : ''].filter(Boolean).join('; ')
    return things ? fill(WORDS.room!, { name: room.name, things }) : fill(WORDS['room-bare']!, { name: room.name })
  }

  /** What they are doing where they stand: the phrase the file wrote for the spot, else the spot's kind. */
  stance(npc: Npc = this.#npc()): string {
    if (!npc.station) return WORDS.walking!
    const anchor = this.#anchor(npc)
    return anchor?.doing || (WORDS[anchor?.kind ?? ''] ?? WORDS.stand!)
  }

  /** Who else is in the building, each with what they are doing there. */
  company(): string {
    const others = this.others()
    if (!others.length) return WORDS.alone!
    return others
      .map((other) => fill(WORDS.person!, { name: other.name, role: other.role, doing: other.life?.reason ?? this.stance(other) }))
      .join('; ')
  }

  /** What the player has on them, by name. */
  carrying(): string {
    const { world, player } = this.#situation
    const names = player.inventory().map((itemId) => world.item(itemId)?.name.toLowerCase()).filter((name) => name !== undefined)
    return names.length ? names.join(', ') : WORDS['empty-handed']!
  }

  /**
   * What people in town say about a place like this, off the charter of the
   * plot they stand in. Somebody out on the street stands in no place and has
   * heard nothing. It is talk rather than knowledge, and the brief says so.
   */
  hearsay(): string {
    const plot = this.#plot()
    const said = (plot && this.#situation.world.charter(plot.kind)?.rumours) || []
    return said.length ? said.map((rumour) => `- ${rumour}`).join('\n') : WORDS['no-hearsay'] ?? ''
  }

  /** How this person takes the player before a word is said. */
  standing(): string {
    return inBand(STANDING, this.#situation.player.reputation()) ?? ''
  }

  /** Who else is in the building, which is who they can see from where they stand. */
  others(): readonly Npc[] {
    const { world, npcId } = this.#situation
    const plotId = this.#plot()?.id
    return plotId ? world.npcsIn(plotId).filter((other) => other.id !== npcId) : []
  }

  /**
   * Things standing on the surfaces of one room, by name: what the file put
   * there and the player has not picked up or moved, plus what the player left
   * there themselves.
   */
  #lyingIn(interior: Interior, roomId: string): string[] {
    const { world, player } = this.#situation
    const anchors = new Set(interior.anchors.filter((anchor) => anchor.roomId === roomId).map((anchor) => anchor.id))
    const here = (interiorId: string, anchorId: string) => interiorId === interior.id && anchors.has(anchorId)
    const stock = world
      .placements()
      .filter((placement) => placement.at === 'anchor' && here(placement.interiorId, placement.anchorId))
      .map((placement) => placement.itemId)
      .filter((itemId) => !player.has(itemId) && !player.placedAt(itemId))
    const left = player.placed().filter((placement) => here(placement.interiorId, placement.anchorId)).map((placement) => placement.itemId)
    return [...stock, ...left].map((itemId) => world.item(itemId)?.name.toLowerCase()).filter((name) => name !== undefined)
  }

  #npc(): Npc {
    return this.#situation.world.npc(this.#situation.npcId)!
  }

  #interior(npc: Npc) {
    return npc.station && this.#situation.world.interior(npc.station.interiorId)
  }

  #anchor(npc: Npc): Anchor | undefined {
    return this.#interior(npc)?.anchors.find((candidate) => candidate.id === npc.station?.anchorId)
  }

  #plot() {
    const interior = this.#interior(this.#npc())
    return interior && this.#situation.world.plot(interior.plotId)
  }
}

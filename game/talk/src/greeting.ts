import { Rng } from '@gb/kit'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Scene } from './scene.ts'
import { bands, fill, inBand, listed } from './text.ts'

const WORDS = listed(PROMPTS.greeting)
const HELLO = bands(WORDS)
const HOOKS = listed(PROMPTS.hook)

/** How often the room gets the word instead of the spot this person keeps in it. */
const COMPANY = 0.3

/**
 * The first words, said the moment the player walks up. Nothing is asked of a
 * model: a reply from one costs seconds, and seconds at the exact moment the
 * player presses the key is an empty panel. So the line is drawn from what the
 * box already knows: the hour, the sky, the building, the spot this person
 * keeps in it, who else is in there, what the player's name is worth here, and
 * the one thing on the menu worth mentioning. The draw is seeded off the
 * world's own seed, so a shared world file greets the same way on every machine.
 */
export class Greeting {
  #situation: Situation
  #scene: Scene

  constructor(situation: Situation) {
    this.#situation = situation
    this.#scene = new Scene(situation)
  }

  /** What they say before the player has said anything. Never empty. */
  line(moves: readonly Move[]): string {
    const rng = this.#stream()
    const parts = [this.#hello(rng), this.#beat(rng), this.#hook(rng, moves)]
    return parts.filter(Boolean).join(' ')
  }

  /**
   * This person's own stream. The world's seed roots it, so the same file
   * greets the same way everywhere; the hour is in the label, so somebody
   * spoken to at dawn and again at dusk does not open with the same line twice.
   */
  #stream(): Rng {
    const { world, player, npcId } = this.#situation
    return new Rng(world.seed).fork(`greeting:${npcId}:${player.clock.phase}`)
  }

  /** How they open: the hour, and what the player's name is worth to them. */
  #hello(rng: Rng): string {
    const pool = inBand(HELLO, this.#situation.player.reputation()) ?? []
    if (!pool.length) return ''
    return fill(rng.pick(pool), { time: this.#word('time', this.#situation.player.clock.phase, rng) })
  }

  /** A word about where they are: the spot they keep, or who else is in with them. */
  #beat(rng: Rng): string {
    const { world, player, npcId } = this.#situation
    const company = this.#scene.others()
    // The room is worth a word now and then, but what they are doing is the
    // line that sounds like them, so it is the one they usually give.
    const nod = company.length > 0 && rng.chance(COMPANY)
    const pool = nod ? (WORDS.company ?? []) : (WORDS[this.#scene.doing ?? 'street'] ?? WORDS.street ?? [])
    if (!pool.length) return ''
    return fill(rng.pick(pool), {
      place: this.#scene.place,
      role: world.npc(npcId)?.role ?? '',
      sky: this.#word('sky', player.clock.weather, rng),
      other: nod ? rng.pick(company).name : '',
    })
  }

  /**
   * The one move worth naming, taken in the order the moves are already weighed
   * so the line and the buttons under it cannot come apart. Nothing to do
   * together is a greeting on its own.
   */
  #hook(rng: Rng, moves: readonly Move[]): string {
    for (const move of moves) {
      const pool = HOOKS[move.action]
      if (pool?.length) return fill(rng.pick(pool), { item: move.subject ?? '' })
    }
    return ''
  }

  /** One of the ways of saying a closed vocabulary word: the hour, the sky. */
  #word(group: string, key: string, rng: Rng): string {
    const pool = WORDS[`${group}-${key}`] ?? []
    return pool.length ? rng.pick(pool) : ''
  }
}

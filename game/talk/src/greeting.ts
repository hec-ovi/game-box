import { Rng } from '@gb/kit'
import type { Grant } from './events.ts'
import { Locks } from './locks.ts'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Scene } from './scene.ts'
import { bands, fill, inBand, listed, sentence } from './text.ts'

const WORDS = listed(PROMPTS.greeting)
const HELLO = bands(WORDS)
const HOOKS = listed(PROMPTS.hook)

/** How often the room gets the word instead of the spot this person keeps in it. */
const COMPANY = 0.3

/**
 * The first words, said the moment the player walks up. Nothing is asked of a
 * model: a reply from one costs seconds, and seconds at the exact moment the
 * player presses the key is an empty panel. So the line is drawn from what the
 * box already knows: the hour, why this person is where they are, the spot
 * they keep, who else is in there, what the player's name is worth here, and
 * the one thing worth mentioning: a payoff that landed as the player walked
 * up, else the first move on the menu with words for it. The draw is seeded off the
 * world's own seed, so a shared world file greets the same way on every machine.
 */
export class Greeting {
  #situation: Situation
  #scene: Scene

  constructor(situation: Situation) {
    this.#situation = situation
    this.#scene = new Scene(situation)
  }

  /** What they say before the player has said anything. Never empty. `granted` is what walking up paid out. */
  line(moves: readonly Move[], granted: readonly Grant[] = []): string {
    const rng = this.#stream()
    const parts = [this.#hello(rng), this.#beat(rng), this.#payoff(rng, granted) || this.#hook(rng, moves)]
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

  /**
   * A word about their own business: why the file says they are here, or the
   * spot they keep, or now and then who else is in with them. The sky is not
   * in it, because the sky is the same for everybody in town.
   */
  #beat(rng: Rng): string {
    const { world, npcId } = this.#situation
    const npc = world.npc(npcId)
    const own = npc?.station ? npc.life?.reason : npc?.life?.errand
    if (own) return fill(rng.pick(WORDS.reason ?? ['{{reason}}']), { reason: sentence(own) })

    const company = this.#scene.others()
    const nod = company.length > 0 && rng.chance(COMPANY)
    const spot = npc?.station ? (WORDS[this.#scene.doing ?? ''] ?? WORDS.stand) : WORDS.street
    const pool = nod ? WORDS.company : spot
    if (!pool?.length) return ''
    return fill(rng.pick(pool), {
      place: this.#scene.place,
      role: npc?.role ?? '',
      other: nod ? rng.pick(company).name : '',
    })
  }

  /** A word, a key or a door that walking up handed over is said here, or the player never hears it. */
  #payoff(rng: Rng, granted: readonly Grant[]): string {
    const grant = granted[0]
    if (!grant) return ''
    const locks = new Locks(this.#situation.world)
    const what =
      'password' in grant ? grant.password
      : 'keyItemId' in grant ? this.#situation.world.item(grant.keyItemId)?.name.toLowerCase()
      : locks.placeOf(grant.access)
    const pool = HOOKS[`granted-${'password' in grant ? 'password' : 'keyItemId' in grant ? 'key' : 'access'}`]
    return what && pool?.length ? fill(rng.pick(pool), { what }) : ''
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

  /** One of the ways of saying a closed vocabulary word: the hour. */
  #word(group: string, key: string, rng: Rng): string {
    const pool = WORDS[`${group}-${key}`] ?? []
    return pool.length ? rng.pick(pool) : ''
  }
}

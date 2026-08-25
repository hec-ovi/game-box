/** What the player can get past: the cards and keys in hand, by what each opens, and the access quests granted outright. */
import { copyAccess, isAccess, sameAccess, type Access } from './access.ts'
import { named } from './named.ts'
import type { KeyDoc } from './schema.ts'

export class Keyring {
  #keys: KeyDoc[] = []

  /** Restore from a save, keeping each key once. A key riding on an item not in hand is dropped. */
  static from(docs: readonly KeyDoc[] | undefined, held: (itemId: string) => boolean): Keyring {
    const ring = new Keyring()
    for (const { opens, itemId } of docs ?? []) {
      if (itemId === undefined) ring.grant(opens)
      else if (held(itemId)) ring.hold(itemId, opens)
    }
    return ring
  }

  /** A card or key came into the player's hand, and this is what it opens. */
  hold(itemId: string, opens: Access): void {
    if (named(itemId)) this.#add({ opens, itemId })
  }

  /** Access given with nothing to carry: a quest reward, a door somebody buzzed open for good. */
  grant(opens: Access): void {
    this.#add({ opens })
  }

  /** The card or key left the player's hand, so whatever it opened is shut to them again. */
  release(itemId: string): void {
    this.#keys = this.#keys.filter((key) => key.itemId !== itemId)
  }

  /** Whether anything in hand or granted opens that. */
  opens(access: Access): boolean {
    return this.#keys.some((key) => sameAccess(key.opens, access))
  }

  list(): readonly KeyDoc[] {
    return this.#keys.map((key) => ({ ...key, opens: copyAccess(key.opens) }))
  }

  get any(): boolean {
    return this.#keys.length > 0
  }

  toJSON(): KeyDoc[] {
    return this.list() as KeyDoc[]
  }

  #add(key: KeyDoc): void {
    if (!isAccess(key.opens)) return
    const twice = this.#keys.some((held) => held.itemId === key.itemId && sameAccess(held.opens, key.opens))
    if (!twice) this.#keys.push({ ...key, opens: copyAccess(key.opens) })
  }
}

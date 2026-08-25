/** The passwords the player has been given, and who gave each: a quest, or a person. */
import { named } from './named.ts'
import type { PasswordDoc, PasswordSourceDoc } from './schema.ts'

/** The longest password kept, the length a world file writes on a door or a machine. */
export const PASSWORD_LENGTH = 60

export type PasswordSource = PasswordSourceDoc

const idOf = (from: PasswordSource): string => ('questId' in from ? from.questId : from.npcId)

export class Passwords {
  #learned: PasswordDoc[] = []

  /** Restore from a save, each password once, the first source kept. */
  static from(docs: readonly PasswordDoc[] | undefined): Passwords {
    const passwords = new Passwords()
    for (const { password, from } of docs ?? []) passwords.learn(password, from)
    return passwords
  }

  /** Keep one, trimmed. Blank, over-long, or from nobody: nothing is kept. Answers whether it was new. */
  learn(password: string, from: PasswordSource): boolean {
    const word = password.trim()
    if (word.length === 0 || word.length > PASSWORD_LENGTH || !named(idOf(from))) return false
    if (this.knows(word)) return false
    this.#learned.push({ password: word, from: 'questId' in from ? { questId: from.questId } : { npcId: from.npcId } })
    return true
  }

  /** Whether the player has been given exactly that word. */
  knows(password: string): boolean {
    const word = password.trim()
    return this.#learned.some((held) => held.password === word)
  }

  list(): readonly PasswordDoc[] {
    return this.#learned.map((held) => ({ password: held.password, from: { ...held.from } }))
  }

  get any(): boolean {
    return this.#learned.length > 0
  }

  toJSON(): PasswordDoc[] {
    return this.list() as PasswordDoc[]
  }
}

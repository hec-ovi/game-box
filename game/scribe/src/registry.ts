import { headOf } from './head.ts'

/**
 * Every name this narrator has already spent. Each call is told what is taken so
 * it does not hand the city its fourth Vidal, and the city's own name so it can
 * write about somewhere rather than about nowhere.
 *
 * A sign is spent twice over: the whole name, and the word it is read by. Two
 * people may share a first name and be told apart by the family name; two
 * signs that start with the same word are one place twice.
 */
export class NameRegistry {
  #cityName = ''
  #names: string[] = []
  #heads: string[] = []

  get cityName(): string {
    return this.#cityName
  }

  nameCity(name: string): void {
    this.#cityName = name
    this.add(name)
  }

  add(name: string): void {
    const trimmed = name.trim()
    if (trimmed && !this.#names.includes(trimmed)) this.#names.push(trimmed)
  }

  /** A sign over a door: spends the name and the word it is read by. */
  hang(sign: string): void {
    this.add(sign)
    const head = headOf(sign)
    if (head && !this.#heads.includes(head)) this.#heads.push(head)
  }

  /** Whether this city has already spent this name on somebody or something else. */
  taken(name: string): boolean {
    return this.#names.includes(name.trim())
  }

  /** Whether a sign's head word is already over another door, or the name itself is spent. */
  signTaken(sign: string): boolean {
    return this.taken(sign) || this.#heads.includes(headOf(sign))
  }

  /** The names most recently spent, oldest first. A whole city is too long to put in a prompt. */
  names(limit = 40): readonly string[] {
    return this.#names.slice(-limit)
  }

  /** The words most recently hung over a door, oldest first. */
  heads(limit = 40): readonly string[] {
    return this.#heads.slice(-limit)
  }
}

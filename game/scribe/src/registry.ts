/**
 * Every name this narrator has already spent. Each call is told what is taken so
 * it does not hand the city its fourth Vidal, and the city's own name so it can
 * write about somewhere rather than about nowhere.
 */
export class NameRegistry {
  #cityName = ''
  #names: string[] = []

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

  /** Whether this city has already spent this name on somebody or something else. */
  taken(name: string): boolean {
    return this.#names.includes(name.trim())
  }

  /** The names most recently spent, oldest first. A whole city is too long to put in a prompt. */
  names(limit = 40): readonly string[] {
    return this.#names.slice(-limit)
  }
}

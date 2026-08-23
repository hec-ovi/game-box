/**
 * Every name this narrator has already spent. Each call is told what is taken so
 * it does not hand the city its fourth Vidal, and the city's own name so it can
 * write about somewhere rather than about nowhere.
 */
export class NameRegistry {
  #cityName = ''
  #names: string[] = []
  #titles: string[] = []

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

  addTitle(title: string): void {
    const trimmed = title.trim()
    if (trimmed && !this.#titles.includes(trimmed)) this.#titles.push(trimmed)
  }

  /** The names most recently spent, oldest first. A whole city is too long to put in a prompt. */
  names(limit = 40): readonly string[] {
    return this.#names.slice(-limit)
  }

  titles(limit = 20): readonly string[] {
    return this.#titles.slice(-limit)
  }
}

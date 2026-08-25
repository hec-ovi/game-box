/** One thing that is internally inconsistent, pointed at where it is. */
export interface IntegrityProblem {
  readonly where: string
  readonly message: string
}

/** Where every check writes what it found, and the one place an id is claimed. */
export class Report {
  readonly problems: IntegrityProblem[] = []
  readonly #seen = new Set<string>()

  fail(where: string, message: string): void {
    this.problems.push({ where, message })
  }

  /** An id is taken once in the whole document, whatever kind of record holds it. */
  claim(where: string, id: string): void {
    if (this.#seen.has(id)) this.fail(where, `duplicate id ${id}`)
    this.#seen.add(id)
  }
}

/** One thing a save named, by the kind of record it sat in. */
export type ResumeKind = 'item' | 'companion' | 'placed' | 'where' | 'tracked' | 'place' | 'person' | 'quest'

export interface ResumeEntry {
  readonly kind: ResumeKind
  readonly id: string
}

/** What a resume kept of the save and what it had to drop, for the player to read. */
export interface ResumeReport {
  /** True when the save was written against another version of this city. */
  readonly rebuilt: boolean
  readonly kept: readonly ResumeEntry[]
  readonly dropped: readonly ResumeEntry[]
}

/** Collects the verdict on every named thing, each once, in the order the save listed them. */
export class Ledger {
  private readonly kept: ResumeEntry[] = []
  private readonly dropped: ResumeEntry[] = []
  private readonly seen = new Set<string>()

  /** Records whether the thing resolves and hands the answer back, so a filter reads as one line. */
  judge(kind: ResumeKind, id: string, resolves: boolean): boolean {
    const key = `${kind}:${id}`
    if (!this.seen.has(key)) {
      this.seen.add(key)
      ;(resolves ? this.kept : this.dropped).push({ kind, id })
    }
    return resolves
  }

  report(rebuilt: boolean): ResumeReport {
    return { rebuilt, kept: [...this.kept], dropped: [...this.dropped] }
  }
}

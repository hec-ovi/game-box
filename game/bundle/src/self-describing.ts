import { roomUseOf, SHIPPED_CHARTERS, type ResolvedCharter, type worldContract } from '@gb/world'
import type { z } from 'zod'

export type WorldDoc = z.infer<typeof worldContract.schema>

/**
 * A world document that says what it was drawn with. A file written before
 * charters names each kind of place by word and leaves every room's use to a
 * table in the reader's build, so the next build could redraw it. With the
 * charters and the uses written in, the file describes itself.
 */
export class SelfDescribing {
  private readonly byWord: ReadonlyMap<string, ResolvedCharter>

  /** Against the charters the document declares, or the presets when it declares none. */
  static of(doc: WorldDoc): SelfDescribing {
    return new SelfDescribing(doc.charters ?? SHIPPED_CHARTERS)
  }

  constructor(charters: readonly ResolvedCharter[]) {
    this.byWord = new Map(charters.map((charter) => [charter.word, charter]))
  }

  /** The words the document's plots and interiors use that name no charter, each once, sorted. */
  unknownWords(doc: WorldDoc): string[] {
    const words = [...doc.plots, ...doc.interiors].map((one) => one.kind)
    return [...new Set(words.filter((word) => !this.byWord.has(word)))].sort()
  }

  /**
   * The document with its charters and every room's use written in, and
   * whether that changed anything. `plot.kind` and all else stay as written.
   */
  describe(doc: WorldDoc): { doc: WorldDoc; upgraded: boolean } {
    let upgraded = doc.charters === undefined
    const interiors = doc.interiors.map((interior) => ({
      ...interior,
      rooms: interior.rooms.map((room) => {
        if (room.use) return room
        upgraded = true
        return { ...room, use: roomUseOf(room, this.charterOf(interior.kind)) }
      }),
    }))
    return { doc: { ...doc, charters: doc.charters ?? this.sortedCharters(), interiors }, upgraded }
  }

  private charterOf(word: string): ResolvedCharter {
    const charter = this.byWord.get(word)
    if (!charter) throw new Error(`no charter declares '${word}'; check unknownWords first`)
    return charter
  }

  /** The presets in the order the world normalises a declared list to, so writing them in is a fixed point. */
  private sortedCharters(): ResolvedCharter[] {
    return [...this.byWord.values()].sort((a, b) => (a.word < b.word ? -1 : 1))
  }
}

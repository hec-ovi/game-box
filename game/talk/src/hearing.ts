import { PROMPTS } from './prompts.generated.ts'
import { listed } from './text.ts'

/** Words too common to tell one thing from another when a name is looked for. */
const VAGUE = new Set(['the', 'a', 'an', 'of', 'and', 'some', 'his', 'her', 'their', 'my', 'your'])

/**
 * Groups read against the words as they were said rather than against what
 * those words were read as. "hand it to me" is a request, and the "it" in it is
 * still pointing at something.
 */
const LOOSE = new Set(['pointing'])

interface Phrase {
  readonly group: string
  readonly words: readonly string[]
}

const VOCABULARY = index(listed(PROMPTS.hearing))

/**
 * What the player just said, read as plain English rather than matched against
 * a keyword. The longest phrase that fits a run of words wins and those words
 * are then spent, so "maybe later" is a refusal and never a goodbye, and "give
 * me the job" is a request about work rather than a request for a thing.
 */
export class Hearing {
  #groups: ReadonlySet<string>
  #words: ReadonlySet<string>

  private constructor(groups: ReadonlySet<string>, words: ReadonlySet<string>) {
    this.#groups = groups
    this.#words = words
  }

  static of(text: string): Hearing {
    const words = tokens(text)
    const groups = new Set<string>()
    for (let at = 0; at < words.length; ) {
      const phrase = (VOCABULARY.spoken.get(words[at]!) ?? []).find((candidate) => fits(words, at, candidate.words))
      if (!phrase) {
        at += 1
        continue
      }
      groups.add(phrase.group)
      at += phrase.words.length
    }
    for (const phrase of VOCABULARY.loose) {
      if (words.some((_word, at) => fits(words, at, phrase.words))) groups.add(phrase.group)
    }
    return new Hearing(groups, new Set(words))
  }

  /** True when the words carried this kind of meaning. */
  has(group: string): boolean {
    return this.#groups.has(group)
  }

  /** True when any of these groups was heard. */
  hasAny(groups: readonly string[]): boolean {
    return groups.some((group) => this.#groups.has(group))
  }

  /** True when they named the thing this move is about, however it is spelt out. */
  names(subject: string | undefined): boolean {
    if (!subject) return false
    const parts = tokens(subject).filter((word) => word.length > 2 && !VAGUE.has(word))
    return parts.length > 0 && parts.some((word) => this.#words.has(word))
  }
}

function tokens(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

function fits(words: readonly string[], at: number, phrase: readonly string[]): boolean {
  return phrase.every((word, offset) => words[at + offset] === word)
}

/** The phrase book, filed under the word each phrase starts with, longest phrase first. */
function index(groups: Record<string, readonly string[]>): {
  spoken: ReadonlyMap<string, readonly Phrase[]>
  loose: readonly Phrase[]
} {
  const all: Phrase[] = []
  for (const [group, phrases] of Object.entries(groups)) {
    for (const phrase of phrases) all.push({ group, words: tokens(phrase) })
  }
  const ordered = all.filter((phrase) => phrase.words.length).sort((a, b) => b.words.length - a.words.length)
  const spoken = new Map<string, Phrase[]>()
  for (const phrase of ordered.filter((candidate) => !LOOSE.has(candidate.group))) {
    const first = phrase.words[0]!
    spoken.set(first, [...(spoken.get(first) ?? []), phrase])
  }
  return { spoken, loose: ordered.filter((phrase) => LOOSE.has(phrase.group)) }
}

/**
 * One entry per word, whichever list said it first, so a word a town could
 * name two things after is spent once. Case is ignored, because two signs
 * differing only in a capital read as one name twice.
 */
export function uniqueWords<T extends { readonly word: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.word.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

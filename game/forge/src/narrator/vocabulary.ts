/**
 * The words a town's own story is told in, fit to head a sign.
 *
 * A town built on a collapsed freight trade should have signs that sound like
 * it, and the premise is the only place that trade is written down. This takes
 * the nouns out of it: every word of four letters or more that is not one of
 * the words any sentence is made of, capitalised, each once.
 */

/** Words no sign is named after: what a sentence is built from rather than about. */
const STOP = new Set(
  `about above across after again against ago along already also although always among another anybody anyone anything
  anywhere around away back because been before being below between beyond both came cannot comes coming could does doing
  done down during each either else enough even ever every everybody everyone everything from gets goes going gone half
  have having held here hers herself himself hold holds holding into itself just keep keeps kept last least left less
  made make makes making many maybe might more most much must myself near nearly neither never next nobody none nothing
  only onto other others ought ours over past rather really same seem seems seen shall should since some somebody someone
  something somewhere still such take taken takes taking than that their theirs them themselves then there these they
  this those though three through till toward towards under until unto upon used uses using very want wanted wants were
  what whatever when whenever where whether which while whole whom whose will with within without would year years
  yourself town city place people whoever anyway before while stop stops stopped comes come went
  lives happened stake sides knows everybody`.split(/\s+/),
)

/** How many words one story lends its signs. */
const MOST = 12

export function vocabularyOf(text: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const token of text.toLowerCase().match(/[a-z]{4,12}/g) ?? []) {
    if (STOP.has(token) || seen.has(token)) continue
    seen.add(token)
    found.push(token[0]!.toUpperCase() + token.slice(1))
    if (found.length >= MOST) break
  }
  return found
}

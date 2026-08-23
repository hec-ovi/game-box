/**
 * What kind of town a theme names. A theme is free text somebody typed, so it
 * is read for the words that decide how the place looks rather than matched
 * against a list.
 */
export type Flavour = 'neon' | 'industrial' | 'coastal' | 'frontier' | 'alpine' | 'agrarian' | 'plain'

/** In order: the first flavour whose words turn up in the theme wins. */
const WORDS: ReadonlyArray<readonly [Flavour, RegExp]> = [
  ['neon', /neon|cyber|synth|chrome|nightcity|night city|megacit|dystop|blade|holo|arcolog/],
  ['industrial', /industr|factor|foundr|steel|smelt|refiner|mill town|smog|soot|works/],
  ['coastal', /coast|harbou?r|port|seaside|fishing|island|bay|marina|wharf|tide/],
  ['frontier', /frontier|desert|western|wild west|dust|canyon|outpost|mining|prospect|badland/],
  ['alpine', /alpine|mountain|snow|glacier|ski|summit|peak|tundra|fjord/],
  ['agrarian', /farm|agrar|rural|village|orchard|harvest|prairie|meadow|vineyard/],
]

/** Which of the seven a theme is. Anything that names none of them is plain. */
export function flavourOf(theme: string): Flavour {
  const text = theme.toLowerCase()
  for (const [flavour, words] of WORDS) if (words.test(text)) return flavour
  return 'plain'
}

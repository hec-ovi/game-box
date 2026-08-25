/**
 * Compiles `premise/*.md` into `src/premise/wording.generated.ts`.
 *
 * The wording a premise is composed from is edited as markdown, so it reads and
 * changes like text rather than like code, and it ships as data so the box
 * bundles into a browser with no file reads at run time.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLACES } from '../src/premise/places.ts'
import { FLAVOURS } from '../src/theme/flavour.ts'

const root = join(import.meta.dirname, '..')

/** One `## handle` block: its keys, each holding every value written under it. */
interface Entry {
  readonly handle: string
  readonly keys: Map<string, string[]>
}

/** Reads the `## handle` / `- key: value` shape both wording files are written in. */
function entriesOf(text: string): Entry[] {
  const entries: Entry[] = []
  for (const line of text.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      entries.push({ handle: heading[1]!, keys: new Map() })
      continue
    }
    const pair = /^-\s+([a-z]+):\s*(.+?)\s*$/.exec(line)
    const entry = entries.at(-1)
    if (!pair || !entry) continue
    const held = entry.keys.get(pair[1]!) ?? []
    held.push(pair[2]!)
    entry.keys.set(pair[1]!, held)
  }
  return entries
}

const one = (entry: Entry, key: string): string => {
  const value = entry.keys.get(key)?.[0]
  if (!value) throw new Error(`${entry.handle}: no ${key}`)
  return value
}

const many = (entry: Entry, key: string): string[] => entry.keys.get(key) ?? []

const list = (entry: Entry, key: string): string[] =>
  many(entry, key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

/** `any` is every kind of town; anything else is the flavours it is named for. */
function fits(entry: Entry): string[] {
  const named = list(entry, 'fits')
  return named.includes('any') ? [...FLAVOURS] : named
}

const quote = (value: string): string => JSON.stringify(value)
const quoted = (values: readonly string[]): string => `[${values.map(quote).join(', ')}]`

/** The kinds an entry declares have to exist in `premise/places.ts`, or the composer would found a town on nothing. */
function declares(entry: Entry): string[] {
  const words = list(entry, 'declares')
  for (const word of words) if (!PLACES[word]) throw new Error(`${entry.handle}: declares ${word}, which premise/places.ts does not hold`)
  return words
}

function kinds(entry: Entry): string {
  return `more: ${quoted(list(entry, 'more'))}, fewer: ${quoted(list(entry, 'fewer'))}, must: ${quoted(list(entry, 'must'))}, declares: ${quoted(declares(entry))}`
}

function trade(entry: Entry): string {
  return `  { handle: ${quote(entry.handle)}, fits: ${quoted(fits(entry))}, lives: ${quote(one(entry, 'lives'))}, word: ${quote(one(entry, 'word'))}, ${kinds(entry)} },`
}

function turn(entry: Entry): string {
  const sides = many(entry, 'side').map((side) => {
    const [name, wants] = side.split('/').map((part) => part.trim())
    if (!name || !wants) throw new Error(`${entry.handle}: a side is "who they are / what they want"`)
    return `{ name: ${quote(name)}, wants: ${quote(wants)} }`
  })
  if (sides.length < 2) throw new Error(`${entry.handle}: an argument needs two sides`)
  return [
    `  {`,
    `    handle: ${quote(entry.handle)},`,
    `    fits: ${quoted(fits(entry))},`,
    `    happened: ${quote(one(entry, 'happened'))},`,
    `    stake: ${quote(one(entry, 'stake'))},`,
    `    sides: [${sides.join(', ')}],`,
    `    known: ${quoted(many(entry, 'known'))},`,
    `    ${kinds(entry)},`,
    `  },`,
  ].join('\n')
}

const trades = entriesOf(readFileSync(join(root, 'premise', 'trades.md'), 'utf8')).map(trade)
const turns = entriesOf(readFileSync(join(root, 'premise', 'turns.md'), 'utf8')).map(turn)

const out = join(root, 'src', 'premise', 'wording.generated.ts')
writeFileSync(
  out,
  [
    '/** Generated from premise/*.md by tools/bundle-wording.ts. Edit the markdown, not this. */',
    "import type { Trade, Turn } from './wording.ts'",
    '',
    'export const TRADES: readonly Trade[] = [',
    ...trades,
    ']',
    '',
    'export const TURNS: readonly Turn[] = [',
    ...turns,
    ']',
    '',
  ].join('\n'),
)
console.log(`wrote ${out}: ${trades.length} trades, ${turns.length} turns`)

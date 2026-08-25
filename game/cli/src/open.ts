import { readFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import type { Io } from './index.ts'

type Opened = Extract<Awaited<ReturnType<typeof Bundle.open>>, { ok: true }>['value']

/**
 * Open a bundle file the way the game would. A file that will not open is
 * explained on `err` with its first ten problems; one written before charters
 * is said so on `out`, since it was read against the presets it was drawn with.
 */
export async function openBundle(file: string, io: Io): Promise<Opened | undefined> {
  const read = readJson(file)
  if ('unreadable' in read) {
    io.err(`${file} cannot be read: ${read.unreadable}`)
    return undefined
  }
  const opened = await Bundle.open(read.document)
  if (!opened.ok) {
    io.err(`${file} will not open: ${opened.error.code}`)
    for (const line of detail(opened.error)) io.err(`  ${line}`)
    return undefined
  }
  if (opened.value.upgraded) io.out(`${file} was written before charters and is read against the presets it was drawn with`)
  return opened.value
}

/** The first ten problems of a refusal, one line each, whichever shape the error carries them in. */
export function detail(error: Record<string, unknown>): string[] {
  const list = (error.problems ?? error.violations) as Array<Record<string, string>> | undefined
  if (list) return list.slice(0, 10).map((p) => `${p.where ?? p.path}: ${p.message}`)
  if (Array.isArray(error.words)) return [`kinds of place the file does not describe: ${error.words.join(', ')}`]
  if (typeof error.message === 'string') return [error.message]
  if (typeof error.expected === 'string') return [`expected ${error.expected}, got ${error.actual}`]
  return []
}

/** The file's JSON, or one line saying why there is none. */
function readJson(file: string): { document: unknown } | { unreadable: string } {
  try {
    return { document: JSON.parse(readFileSync(file, 'utf8')) as unknown }
  } catch (cause) {
    return { unreadable: (cause as Error).message }
  }
}

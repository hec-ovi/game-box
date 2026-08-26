/**
 * The prompts and the code, read off disk while the page is open.
 *
 * Nothing here is a copy. The prompt files come from `game/scribe/prompts`, the
 * one place the build reads them from, and every file and line the page points
 * at is found by searching the real source, so a page that cannot find a call
 * site says so instead of printing a line number that has moved.
 */
import { FILES } from 'virtual:lab-sources'
import { PROMPTS } from '../../../game/scribe/src/prompts.generated.ts'

const PROMPT_DIR = 'game/scribe/prompts/'

export interface PromptFile {
  readonly name: string
  readonly path: string
  readonly text: string
  /** Set when the file on disk and the bundle the build actually sends have parted. */
  readonly drifted: boolean
}

/** One prompt file, as it is on disk, beside what `pnpm --filter @gb/scribe run generate` bundled. */
export function promptFile(name: string): PromptFile {
  const path = `${PROMPT_DIR}${name}.md`
  const text = FILES[path]
  const bundled = (PROMPTS as Record<string, string | undefined>)[name]
  if (text === undefined) return { name, path, text: bundled ?? `(no ${path} on disk)`, drifted: bundled !== undefined }
  return { name, path, text, drifted: bundled !== undefined && bundled !== text }
}

export interface Site {
  readonly path: string
  /** 0 when the marker is no longer in the file, which is itself worth seeing. */
  readonly line: number
  readonly text: string
  readonly what: string
}

/** Where a call is issued: the first line of `path` holding `marker`, found now rather than remembered. */
export function site(path: string, marker: string, what: string): Site {
  const source = FILES[path]
  if (source === undefined) return { path, line: 0, text: `(${path} is not in the lab's reach)`, what }
  const lines = source.split('\n')
  const at = lines.findIndex((line) => line.includes(marker))
  if (at < 0) return { path, line: 0, text: `(no line holds ${marker} any more)`, what }
  return { path, line: at + 1, text: lines[at]!.trim(), what }
}

/** One file the page reads, when it wants to quote a rule rather than describe it. */
export function fileText(path: string): string | undefined {
  return FILES[path]
}

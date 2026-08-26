/**
 * Where the stages come from.
 *
 * The pipeline's own spec is `docs/PIPELINE-V2.md`. When it is there, each
 * stage's number, name and opening line are read off it while the page is open,
 * so renaming a stage in the spec renames it here and nowhere else has to be
 * touched. What a stage cannot be read off a document is the rest: the tool, the
 * schema, the call site and the sandbox are bound to real functions, and only
 * code can reach those.
 *
 * A stage is matched by its number, not its wording, so the spec may rename a
 * stage freely. With no spec file, or no heading for a number, the page falls
 * back to what the stage file itself says and says so.
 */
import { fileText } from './source.ts'

export const SPEC_PATH = 'docs/PIPELINE-V2.md'

export interface StageSpec {
  readonly n: number
  readonly title: string
  readonly lede: string
}

const spec = fileText(SPEC_PATH)

/** Headings of the shape `## 3. The people`, with the first paragraph under each. */
const stages = spec === undefined ? new Map<number, StageSpec>() : read(spec)

function read(document: string): Map<number, StageSpec> {
  const found = new Map<number, StageSpec>()
  const blocks = document.split(/\n(?=#{2,3} )/)
  for (const block of blocks) {
    const heading = /^#{2,3}\s+(?:stage\s+)?(\d+)[.:)]?\s+(.+)$/im.exec(block.split('\n')[0] ?? '')
    if (!heading) continue
    const n = Number(heading[1])
    if (found.has(n)) continue
    found.set(n, { n, title: heading[2]!.replace(/\s*\(.*\)\s*$/, '').trim(), lede: firstParagraph(block) })
  }
  return found
}

function firstParagraph(block: string): string {
  const lines = block.split('\n').slice(1)
  const paragraph: string[] = []
  for (const line of lines) {
    const text = line.trim()
    if (!text) {
      if (paragraph.length) break
      continue
    }
    if (text.startsWith('#') || text.startsWith('|') || text.startsWith('```')) break
    paragraph.push(text)
  }
  return paragraph.join(' ')
}

export function stageSpec(n: number): StageSpec | undefined {
  return stages.get(n)
}

/** What the page is reading its stage names from, said out loud so nobody has to guess. */
export function specSays(): string {
  if (spec === undefined) return `no ${SPEC_PATH} yet: stage names are the ones in tools/lab/src/stages/`
  if (stages.size === 0) return `${SPEC_PATH} is there but holds no "## <n>. <name>" heading: stage names are the ones in tools/lab/src/stages/`
  return `stage names read from ${SPEC_PATH} (${[...stages.keys()].sort().join(', ')})`
}

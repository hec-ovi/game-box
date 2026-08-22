/**
 * Prompts live in prompts/*.md so they can be read and edited as text.
 * This bundles them into one module so the same code runs in Node and in a
 * browser, where there is no filesystem.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'prompts')
const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()

const entries = files
  .map((file) => {
    const name = file.replace(/\.md$/, '')
    return `  ${JSON.stringify(name)}: ${JSON.stringify(readFileSync(join(dir, file), 'utf8'))},`
  })
  .join('\n')

const out = join(import.meta.dirname, '..', 'src', 'prompts.generated.ts')
writeFileSync(
  out,
  `/** Generated from prompts/*.md by tools/bundle-prompts.ts. Edit the markdown, not this. */
export const PROMPTS = {
${entries}
} as const

export type PromptName = keyof typeof PROMPTS
`,
)
console.log(`wrote ${out} (${files.length} prompts)`)

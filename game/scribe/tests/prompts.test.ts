import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROMPTS } from '../src/prompts.generated.ts'

const dir = join(import.meta.dirname, '..', 'prompts')
const files = readdirSync(dir).filter((file) => file.endsWith('.md'))

describe('the prompts', () => {
  it('are bundled from the markdown, byte for byte', () => {
    const onDisk = Object.fromEntries(
      files.map((file) => [file.replace(/\.md$/, ''), readFileSync(join(dir, file), 'utf8')]),
    )
    expect({ ...PROMPTS }).toEqual(onDisk)
  })

  it('never cap how long an answer runs', () => {
    for (const [name, text] of Object.entries(PROMPTS)) {
      expect(text, `${name} caps the answer`).not.toMatch(/\bmax_tokens\b/)
      expect(text, `${name} caps the answer`).not.toMatch(/\b(?:in|at most|no more than|under|within)\s+\w+\s+(?:words?|characters?|sentences?|lines?)\b/i)
      expect(text, `${name} caps the answer`).not.toMatch(/\b(?:words?|characters?|sentences?)\s+(?:or fewer|or less|max(?:imum)?)\b/i)
    }
  })

  it('show no example a model could hand back as an answer', () => {
    // measured: a house-style example name came back as a bar's name. A shape is
    // shown with bracketed slots, never with a name that could be copied
    for (const [name, text] of Object.entries(PROMPTS)) {
      expect(text, `${name} quotes a name the model can copy`).not.toMatch(/"(?:The )?[A-Z][a-z]+(?: (?:[A-Z&][a-z]*|of|the))+"/)
      expect(text, `${name} quotes a name the model can copy`).not.toMatch(/"[A-Z][a-z]+'s [A-Z][a-z]+"/)
    }
    expect(PROMPTS['name-signs']).toMatch(/\[first name\]/)
    expect(PROMPTS['write-quest']).toMatch(/\[thing\]/)
  })

  it('are all reachable from the code that sends them', () => {
    const source = readdirSync(join(import.meta.dirname, '..', 'src'), { recursive: true, encoding: 'utf8' })
      .filter((file) => typeof file === 'string' && file.endsWith('.ts') && !file.endsWith('.generated.ts'))
      .map((file) => readFileSync(join(import.meta.dirname, '..', 'src', file), 'utf8'))
      .join('\n')
    for (const name of Object.keys(PROMPTS)) {
      expect(source, `nothing loads prompts/${name}.md`).toContain(`'${name}'`)
    }
  })
})

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Narrator } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { run } from '../src/index.ts'
import { narratorFor, storied } from '../src/narrator.ts'
import { city } from './city.ts'

function capture() {
  const out: string[] = []
  const err: string[] = []
  return { out, err, io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) } }
}

const dir = mkdtempSync(join(tmpdir(), 'gb-cli-'))
const fixtures = new URL('./fixtures/', import.meta.url)

/** A city on disk for the commands that read one. What writes one is a model, so no test here builds one. */
async function town(name: string) {
  const file = join(dir, name)
  await city(file, { seed: 'cli', blocksX: 1, blocksY: 1, blockCells: 12 })
  return file
}

describe('gb', () => {
  it('checks a bundle, including that every building can be walked to', async () => {
    const file = await town('checkable.json')
    const io = capture()

    expect(await run(['check', file], io.io)).toBe(0)
    expect(io.out.join('\n')).toContain('every building can be walked to')
  })

  it('takes a history from a file as the answer to writePremise', async () => {
    // `--history <file>` is a story somebody wrote by hand standing in for the
    // one the model would write, and nothing else about the build changes
    const file = fileURLToPath(new URL('history.json', fixtures))
    const written = storied(narratorFor('cli').narrator, file)
    expect(typeof written).toBe('object')

    const answer = await (written as Narrator).writePremise!({ theme: 'quiet coastal town', seed: 'cli' })
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value.build.mustHave).toEqual(['customs'])
    expect(answer.value.charters?.map((charter) => charter.word)).toContain('lighthouse')
  })

  it('refuses a history file it cannot read', async () => {
    const io = capture()
    const code = await run(['build', '--history', join(dir, 'no-such-history.json'), '--out', join(dir, 'unstoried.json')], io.io)

    expect(code).toBe(1)
    expect(io.err.join('\n')).toContain('no-such-history.json cannot be read')
  })

  it('refuses a city too big for a world to hold', async () => {
    const io = capture()
    const code = await run(['build', '--blocks', '60x1', '--cells', '40', '--out', join(dir, 'huge.json')], io.io)

    expect(code).toBe(1)
    expect(io.err.join('\n')).not.toBe('')
    expect(existsSync(join(dir, 'huge.json'))).toBe(false)
  })

  it('prints the grid, the places and the quests', async () => {
    const file = await town('printable.json')
    const io = capture()

    expect(await run(['inspect', file], io.io)).toBe(0)
    const text = io.out.join('\n')
    expect(text).toContain('places')
    expect(text).toContain('quests')
    expect(text).toMatch(/^M+$/m) // the mountain ring
  })

  it('says when a city was written before charters', async () => {
    // the file is read against the presets it was drawn with, and whoever
    // checks it should know the city is older than the format it opens under
    const file = fileURLToPath(new URL('before-charters.json', fixtures))
    const io = capture()

    expect(await run(['check', file], io.io)).toBe(0)
    expect(io.out.join('\n')).toContain('written before charters')
  })

  it('refuses a bundle that was edited after it was sealed', async () => {
    const file = await town('tampered.json')
    const bundle = JSON.parse(readFileSync(file, 'utf8'))
    bundle.world.name = 'Somewhere Else'
    writeFileSync(file, JSON.stringify(bundle))

    const io = capture()
    expect(await run(['check', file], io.io)).toBe(1)
    expect(io.err.join('\n')).toContain('content-changed')
  })

  it('explains itself and refuses what it does not understand', async () => {
    const help = capture()
    expect(await run(['help'], help.io)).toBe(0)
    expect(help.out.join('\n')).toContain('gb build')

    const bare = capture()
    expect(await run([], bare.io)).toBe(1)

    const wrong = capture()
    expect(await run(['teleport'], wrong.io)).toBe(1)
    expect(wrong.err.join('\n')).toContain('unknown command')

    const missing = capture()
    expect(await run(['check'], missing.io)).toBe(1)
    expect(missing.err.join('\n')).toContain('needs a bundle or pack file')

    const absent = capture()
    expect(await run(['inspect', join(dir, 'no-such-city.json')], absent.io)).toBe(1)
    expect(absent.err.join('\n')).toContain('no-such-city.json cannot be read')
  })
})

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from '../src/index.ts'

function capture() {
  const out: string[] = []
  const err: string[] = []
  return { out, err, io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) } }
}

const dir = mkdtempSync(join(tmpdir(), 'gb-cli-'))

async function buildTown(name = 'town.json', extra: string[] = []) {
  const file = join(dir, name)
  const io = capture()
  const code = await run(['build', '--seed', 'cli', '--blocks', '1x1', '--cells', '12', '--out', file, ...extra], io.io)
  return { file, code, ...io }
}

describe('gb', () => {
  it('builds a city and writes it as a bundle', async () => {
    const { file, code, out } = await buildTown()
    expect(code).toBe(0)

    const text = out.join('\n')
    expect(text).toMatch(/buildings, \d+ people/)
    expect(text).toContain(file)

    const bundle = JSON.parse(readFileSync(file, 'utf8'))
    expect(bundle.format).toBe('game-box.bundle')
    expect(bundle.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(bundle.world.plots.length).toBeGreaterThan(0)
  })

  it('checks a bundle, including that every building can be walked to', async () => {
    const { file } = await buildTown('checkable.json')
    const io = capture()

    expect(await run(['check', file], io.io)).toBe(0)
    expect(io.out.join('\n')).toContain('every building can be walked to')
  })

  it('prints the grid, the places and the quests', async () => {
    const { file } = await buildTown('printable.json')
    const io = capture()

    expect(await run(['inspect', file], io.io)).toBe(0)
    const text = io.out.join('\n')
    expect(text).toContain('places')
    expect(text).toContain('quests')
    expect(text).toMatch(/^M+$/m) // the mountain ring
  })

  it('refuses a bundle that was edited after it was sealed', async () => {
    const { file } = await buildTown('tampered.json')
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
    expect(missing.err.join('\n')).toContain('needs a bundle file')
  })
})

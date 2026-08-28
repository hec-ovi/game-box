import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Bundle } from '@gb/bundle'
import { beforeAll, describe, expect, it } from 'vitest'
import { GROWTH } from '../src/extend.ts'
import { run } from '../src/index.ts'
import { city, growPlots, seal } from './city.ts'

function capture() {
  const out: string[] = []
  const err: string[] = []
  return { out, err, io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) } }
}

const dir = mkdtempSync(join(tmpdir(), 'gb-pack-'))
const at = (name: string) => join(dir, name)
const bytes = (name: string) => readFileSync(at(name), 'utf8')

async function gb(...argv: string[]) {
  const io = capture()
  const code = await run(argv, io.io)
  return { code, out: io.out.join('\n'), err: io.err.join('\n') }
}

// one base, grown once, cut once, applied twice: the whole pipeline through the
// command. The two cities and the growth are laid out rather than written,
// because a pack is cut from records and a record is arithmetic
beforeAll(async () => {
  await city(at('base.json'), { seed: 'pack', blocksX: 3, blocksY: 3, density: 0.5 })
  await city(at('other.json'), { seed: 'elsewhere', blocksX: 1, blocksY: 1 })

  const opened = await Bundle.open(JSON.parse(bytes('base.json')))
  if (!opened.ok) throw new Error(`the base will not open: ${opened.error.code}`)
  const { world, requires } = opened.value
  await seal(at('grown.json'), world, growPlots(world, 30), { generator: GROWTH, requires })
})

describe('gb pack and apply', () => {
  it('cuts what the growth added into a pack that names its base', async () => {
    const { code, out } = await gb('pack', at('base.json'), at('grown.json'), '--out', at('pack.json'))

    expect(code).toBe(0)
    const base = JSON.parse(bytes('base.json'))
    const pack = JSON.parse(bytes('pack.json'))
    expect(pack.format).toBe('game-box.pack')
    expect(pack.base).toEqual({ worldId: base.world.id, contentHash: base.contentHash })
    const grown = JSON.parse(bytes('grown.json'))
    expect(pack.world.plots.length).toBe(grown.world.plots.length - base.world.plots.length)
    expect(out).toContain(`a pack for ${base.world.id} at ${base.contentHash.slice(0, 12)}`)
    expect(out).toContain(`${pack.world.plots.length} buildings, ${pack.world.interiors.length} interiors, ${pack.world.npcs.length} people`)
  })

  it('applies the pack to the same bytes every time, and gives back the grown city', async () => {
    // determinism is the whole promise of a pack: the same base and the same
    // pack are the same city on every machine, and the city the growth was
    // cut from, so every save written against it resumes whole
    const first = await gb('apply', at('base.json'), at('pack.json'), '--out', at('applied-1.json'))
    const second = await gb('apply', at('base.json'), at('pack.json'), '--out', at('applied-2.json'))

    expect(first.code).toBe(0)
    expect(second.code).toBe(0)
    expect(bytes('applied-1.json')).toBe(bytes('applied-2.json'))
    expect(bytes('applied-1.json')).toBe(bytes('grown.json'))
    const pack = JSON.parse(bytes('pack.json'))
    expect(first.out).toContain(`${pack.world.plots.length} of them from the pack`)
  })

  it('checks a pack: which base it names alone, and that it applies given the base', async () => {
    const alone = await gb('check', at('pack.json'))
    const base = JSON.parse(bytes('base.json'))
    expect(alone.code).toBe(0)
    expect(alone.out).toContain(`a pack for ${base.world.id} at ${base.contentHash.slice(0, 12)}`)

    const against = await gb('check', at('pack.json'), '--base', at('base.json'))
    expect(against.code).toBe(0)
    expect(against.out).toContain('applies to')
    expect(against.out).toContain('every building can be walked to')

    const wrong = await gb('check', at('pack.json'), '--base', at('other.json'))
    expect(wrong.code).toBe(1)
    expect(wrong.err).toContain('pack-mismatch')
  })

  it('refuses a pack cut from another city, and one edited after it was sealed', async () => {
    const mismatch = await gb('apply', at('other.json'), at('pack.json'), '--out', at('never.json'))
    expect(mismatch.code).toBe(1)
    expect(mismatch.err).toContain('pack-mismatch')
    expect(mismatch.err).toMatch(/expected world_\d+ at [a-f0-9]{64}, got world_\d+ at [a-f0-9]{64}/)

    const pack = JSON.parse(bytes('pack.json'))
    pack.world.plots[0].name = 'Somewhere Else'
    writeFileSync(at('tampered.json'), JSON.stringify(pack))
    const tampered = await gb('apply', at('base.json'), at('tampered.json'), '--out', at('never.json'))
    expect(tampered.code).toBe(1)
    expect(tampered.err).toContain('content-changed')
  })

  it('cuts no pack from a city that is not an extension of the base', async () => {
    const { code, err } = await gb('pack', at('base.json'), at('other.json'), '--out', at('never.json'))
    expect(code).toBe(1)
    expect(err).toContain('not-an-extension')
    expect(err).toMatch(/^ {2}\S+: .+/m)
  })

  it('says what each command needs', async () => {
    expect((await gb('extend')).err).toContain('needs a bundle file')
    expect((await gb('extend', at('base.json'), '--count', 'many')).err).toContain('count')
    expect((await gb('pack', at('base.json'))).err).toContain('needs the base bundle and the grown one')
    expect((await gb('apply', at('base.json'))).err).toContain('needs the base bundle and the pack')
    expect((await gb('apply', at('base.json'), at('no-such-pack.json'))).err).toContain('no-such-pack.json cannot be read')
    expect((await gb('build', '--bogus')).err).toContain('cannot read the arguments')
  })
})

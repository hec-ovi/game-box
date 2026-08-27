import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOM_SIZE } from '../src/rooms.ts'
import { InvalidTheme, planStrip, readTheme, type ThemeDoc } from '../src/theme.ts'
import { SHIPPED, ThemePack } from '../tools/theme.ts'

const shipped = readTheme(JSON.parse(readFileSync(new URL('../themes/gb/theme.json', import.meta.url), 'utf8')))

/** The shipped pack with one field replaced, which is what a pack of somebody's own looks like coming in. */
function themed(over: Partial<ThemeDoc>): unknown {
  return { ...shipped, ...over }
}

/** A pack folder on disk holding just this manifest and nothing else. */
async function packOf(doc: unknown): Promise<ThemePack> {
  const folder = await mkdtemp(join(tmpdir(), 'gb-theme-'))
  await writeFile(join(folder, 'theme.json'), JSON.stringify(doc))
  await mkdir(join(folder, 'rooms'), { recursive: true })
  return await ThemePack.at(folder)
}

describe('a theme pack', () => {
  it('round trips: every picture it declares gets a layer, and both kinds of window read a run of them', () => {
    const plan = planStrip(shipped)
    expect(plan.layers).toHaveLength(shipped.rooms.length + shipped.windows.length + 4)
    expect(plan.layers.filter((layer) => layer.folder === 'faces').map((layer) => layer.file)).toEqual([
      shipped.faces.floor,
      shipped.faces.ceiling,
      shipped.faces.side,
      shipped.faces.sideAlt,
    ])

    // a bank is a run, and the run holds exactly the pictures that named it
    for (const [field, banks] of [
      ['rooms', plan.strip.rooms],
      ['panels', plan.strip.panels],
    ] as const) {
      const declared = field === 'rooms' ? shipped.rooms : shipped.windows
      for (const where of ['upper', 'street'] as const) {
        const run = plan.layers.slice(banks[where].first, banks[where].first + banks[where].count).map((layer) => layer.file)
        expect(new Set(run), `${field} ${where}`).toEqual(new Set(declared.filter((picture) => picture.where.includes(where)).map((picture) => picture.file)))
      }
    }

    // and nothing points outside the strip
    for (const at of Object.values(plan.strip.faces)) expect(at).toBeLessThan(plan.layers.length)
  })

  it('refuses a manifest that is not one, whole, rather than half applying it', () => {
    expect(() => readTheme(themed({ theme: 'Not A Name' }))).toThrow(InvalidTheme)
    expect(() => readTheme(themed({ ads: [] }))).toThrow(InvalidTheme)
    // a name that walks out of the pack's own folders
    expect(() => readTheme(themed({ ads: ['../../secrets.png'] }))).toThrow(InvalidTheme)
    // nothing left for a shop window to show
    expect(() => readTheme(themed({ windows: shipped.windows.map((picture) => ({ ...picture, where: ['upper' as const] })) }))).toThrow(InvalidTheme)
    // one file claiming two slots in the strip
    expect(() => readTheme(themed({ rooms: [...shipped.rooms, shipped.rooms[0]!] }))).toThrow(InvalidTheme)

    try {
      readTheme(themed({ theme: 'Not A Name', ads: [] }))
      expect.unreachable('a malformed manifest was accepted')
    } catch (refused) {
      expect(refused).toBeInstanceOf(InvalidTheme)
      expect((refused as InvalidTheme).violations.map((violation) => violation.path)).toEqual(['theme', 'ads'])
    }
  })

  it('falls back to what ships for an image it does not carry, and draws one nothing carries', async () => {
    const pack = await packOf(themed({ rooms: [{ file: 'nobody-has-this.png', where: ['upper', 'street'] }, ...shipped.rooms.slice(1)] }))

    // carried by the shipped pack under the same name, so an empty folder of
    // your own still builds the city the shipped art draws
    const borrowed = await pack.pixels('rooms', shipped.rooms[1]!.file, ROOM_SIZE)
    const own = await (await ThemePack.at(SHIPPED)).pixels('rooms', shipped.rooms[1]!.file, ROOM_SIZE)
    expect(Buffer.compare(borrowed, own)).toBe(0)

    // carried by nobody, so it is drawn: a real surface with light on it,
    // never a blank layer
    const drawn = await pack.pixels('rooms', 'nobody-has-this.png', ROOM_SIZE)
    expect(drawn).toHaveLength(ROOM_SIZE * ROOM_SIZE * 4)
    const levels = new Set<number>()
    for (let at = 0; at < drawn.length; at += 4) levels.add(drawn[at]!)
    expect(levels.size, 'a drawn panel is one flat colour').toBeGreaterThan(8)
  })

  it('draws the panels and the faces the shipped pack has no image for yet, so no window is a blank rectangle', async () => {
    const pack = await ThemePack.at(SHIPPED)
    const declared = [
      ...shipped.windows.map((picture) => ['windows', picture.file] as const),
      ...Object.values(shipped.faces).map((file) => ['faces', file] as const),
    ]
    for (const [folder, file] of declared) {
      const pixels = await pack.pixels(folder, file, 32)
      let brightest = 0
      for (let at = 0; at < pixels.length; at += 4) brightest = Math.max(brightest, pixels[at]!, pixels[at + 1]!, pixels[at + 2]!)
      expect(brightest, file).toBeGreaterThan(16)
    }
  })
})

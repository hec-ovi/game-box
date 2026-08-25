import { readFileSync } from 'node:fs'
import { SHIPPED_CHARTERS, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Bundle, contentHash, type BundleDoc } from '../src/index.ts'

const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-bundle.json', import.meta.url), 'utf8')) as BundleDoc

/**
 * The sealed city with its clinic declared under a word no build knows. The
 * charter keeps the clinic's resolved values, so the only thing invented is
 * the word, which is all a file has to declare for a kind of place to exist.
 */
async function jailTown(): Promise<BundleDoc> {
  const rename = <T extends { kind: string }>(one: T): T => (one.kind === 'clinic' ? { ...one, kind: 'jail' } : one)
  const charters = SHIPPED_CHARTERS.map((charter) => (charter.word === 'clinic' ? { ...charter, word: 'jail', label: 'jail', blade: 'JAIL' } : charter))
  const world = World.load({ ...SEALED.world, charters, plots: SEALED.world.plots.map(rename), interiors: SEALED.world.interiors.map(rename) })
  if (!world.ok) throw new Error(JSON.stringify(world.error).slice(0, 300))
  return Bundle.pack(world.value, SEALED.quests)
}

/** The same body under a fresh seal, so the only thing wrong with it is what the test changed. */
async function resealed(doc: BundleDoc, world: BundleDoc['world']): Promise<unknown> {
  const { contentHash: _old, ...body } = { ...doc, world }
  return { ...body, contentHash: await contentHash(body) }
}

describe('a city whose kinds of place are its own', () => {
  it('opens a file that declares a word no build knows, as a place like any other', async () => {
    const opened = await Bundle.open(JSON.parse(JSON.stringify(await jailTown())))
    expect(opened.ok, JSON.stringify('error' in opened ? opened.error : '').slice(0, 300)).toBe(true)
    if (!opened.ok) return

    expect(opened.value.upgraded).toBe(false)
    expect(opened.value.world.charter('jail')?.blade).toBe('JAIL')
    expect(opened.value.world.plotsOfKind('jail').length).toBe(1)
    expect(opened.value.world.charter('clinic')).toBeUndefined()
  })

  it('refuses a file whose plots use a word it does not declare, naming the word', async () => {
    const doc = await jailTown()
    const { charters: _declared, ...undeclared } = doc.world

    const readAgainstPresets = await Bundle.open(await resealed(doc, undeclared))
    expect(readAgainstPresets.ok).toBe(false)
    if (!readAgainstPresets.ok) expect(readAgainstPresets.error).toEqual({ code: 'unknown-kind', words: ['jail'] })

    const presets = [...SHIPPED_CHARTERS].sort((a, b) => (a.word < b.word ? -1 : 1))
    const declaredWithout = await Bundle.open(await resealed(doc, { ...doc.world, charters: presets }))
    expect(declaredWithout.ok).toBe(false)
    if (!declaredWithout.ok) expect(declaredWithout.error).toEqual({ code: 'unknown-kind', words: ['jail'] })
  })
})

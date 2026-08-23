import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { World, type WorldDoc } from '../src/index.ts'
import { sealOf } from './seal.ts'

/**
 * A city `@gb/forge` built and `@gb/bundle` sealed, checked in as it was
 * shared. It is never regenerated: regenerating it is deleting the only proof
 * that a file somebody else already has still opens after this box changes.
 *
 * Everything added here is optional, so this document is also the proof that
 * an absent field costs a shared city nothing: it loads, it holds together,
 * and saving it back hashes to the string it was sealed with.
 */
const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-bundle.json', import.meta.url), 'utf8')) as {
  contentHash: string
  world: WorldDoc
}

describe('a city sealed before this box changed', () => {
  it('still opens, still holds together, and saving it back leaves the seal where it was', async () => {
    const opened = World.load(SEALED.world)
    expect(opened.ok, `the sealed city no longer loads: ${JSON.stringify('error' in opened ? opened.error : '')}`).toBe(true)
    if (!opened.ok) return
    expect(opened.value.check()).toEqual([])

    const { contentHash, ...body } = SEALED
    expect(await sealOf({ ...body, world: opened.value.toJSON() })).toBe(contentHash)
  })
})

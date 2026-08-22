/** The model cache: nothing comes back unverified. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { Cache, resolvedModelContract } from '../src/models/index.ts'

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'game-box-models-'))
  dirs.push(dir)
  return dir
}

function entry(sha256: string): Record<string, unknown> {
  return { id: 'qwen3-4b', file: 'qwen3-4b.bin', sha256 }
}

describe('the cache', () => {
  it('resolves a cached file and reports it on contract', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'qwen3-4b.bin'), 'hello')

    const resolved = await Cache.at(dir).resolve(entry(HELLO_SHA256))
    assert.ok(resolved.ok, `expected a resolved model: ${JSON.stringify(resolved)}`)
    assert.ok(resolvedModelContract.is(resolved.value), `off-contract: ${JSON.stringify(resolved.value)}`)
    assert.equal(resolved.value.id, 'qwen3-4b')
    assert.equal(resolved.value.sizeBytes, 5)
    assert.equal(resolved.value.path, join(dir, 'qwen3-4b.bin'))
  })

  it('fails closed on missing, corrupt and malformed entries', async () => {
    const dir = tempDir()
    const cache = Cache.at(dir)

    const missing = await cache.resolve(entry(HELLO_SHA256))
    assert.ok(!missing.ok)
    assert.equal(missing.error.code, 'missing')
    assert.equal(missing.error.code === 'missing' && missing.error.path, join(dir, 'qwen3-4b.bin'))

    writeFileSync(join(dir, 'qwen3-4b.bin'), 'tampered')
    const corrupt = await cache.resolve(entry(HELLO_SHA256))
    assert.ok(!corrupt.ok)
    assert.equal(corrupt.error.code, 'integrity')

    for (const bad of [
      {},
      { id: 'x', file: '../escape.bin', sha256: HELLO_SHA256 },
      { id: 'x', file: 'x.bin', sha256: 'not-a-digest' },
      { id: 'x', file: 'x.bin', sha256: HELLO_SHA256, extra: 1 },
    ]) {
      const resolved = await cache.resolve(bad)
      assert.ok(!resolved.ok, `expected a refusal for ${JSON.stringify(bad)}`)
      assert.equal(resolved.error.code, 'invalid-entry')
    }
  })

  it('takes its root from the env override', () => {
    process.env.GAME_BOX_MODELS_DIR = '/opt/game-box-models'
    assert.equal(Cache.open().root, '/opt/game-box-models')
    delete process.env.GAME_BOX_MODELS_DIR
  })
})

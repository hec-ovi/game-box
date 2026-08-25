import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import type { QuestDoc } from '@gb/quest'
import type { World } from '@gb/world'
import { Bundle, type BundleError, type OpenedBundle } from '../bundle.ts'
import type { AssetPackRef, BundleDoc } from '../schema.ts'
import { contentHash } from '../stable-json.ts'
import { appended } from './appended.ts'
import { Extension } from './extension.ts'
import { packContract, type PackDoc } from './schema.ts'

export type PackError =
  | { readonly code: 'not-an-extension'; readonly problems: readonly SchemaViolation[] }
  | { readonly code: 'invalid-pack'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'pack-mismatch'; readonly expected: PackDoc['base']; readonly actual: PackDoc['base'] }

/** A city as a pack sees it: the world and the quests written for it. An opened bundle is one. */
export interface City {
  readonly world: World
  readonly quests: readonly QuestDoc[]
}

/**
 * The file an addition to a finished city travels in. Cutting one keeps only
 * what the extension added, against the base's hash; applying one gives back
 * the extended city byte for byte, with every base entry as it was.
 */
export class Pack {
  /** What `extended` added to `base`, sealed. `extended` is the base grown by `Forge.extend`, with the quests written for what it added on the end of the base's. */
  static async cut(base: OpenedBundle, extended: City, options: { generator?: string; version?: string } = {}): Promise<Result<PackDoc, PackError>> {
    const extension = Extension.between(base.world.toJSON(), extended.world.toJSON())
    const quests = appended(base.quests, extended.quests, 'quests')
    if (!extension.ok || !quests.ok) {
      return err({ code: 'not-an-extension', problems: [...(extension.ok ? [] : extension.error), ...(quests.ok ? [] : quests.error)] })
    }
    const body = {
      format: 'game-box.pack' as const,
      schemaVersion: 1 as const,
      base: { worldId: base.world.id, contentHash: base.contentHash },
      world: extension.value.doc,
      quests: quests.value,
      createdWith: { generator: options.generator ?? 'forge', version: options.version ?? '0.1.0' },
    }
    return ok({ ...body, contentHash: await contentHash(body) })
  }

  /**
   * The base with an untrusted pack in it: shape, the pack's hash, the base it
   * names, then the extended city through the same gate a file opens by. The
   * base handed in is read and never written. `have` is the art the reader has loaded.
   */
  static async apply(base: OpenedBundle, value: unknown, have: readonly AssetPackRef[] = []): Promise<Result<OpenedBundle, PackError | BundleError>> {
    const parsed = packContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-pack', violations: parsed.error })
    const doc = parsed.value

    const { contentHash: claimed, ...body } = doc
    const actual = await contentHash(body)
    if (actual !== claimed) return err({ code: 'content-changed', expected: claimed, actual })

    const here = { worldId: base.world.id, contentHash: base.contentHash }
    if (doc.base.worldId !== here.worldId || doc.base.contentHash !== here.contentHash) {
      return err({ code: 'pack-mismatch', expected: doc.base, actual: here })
    }

    const world = new Extension(doc.world).applyTo(base.world.toJSON())
    if (!world.ok) return err({ code: 'invalid-pack', violations: world.error })
    const city: Omit<BundleDoc, 'contentHash'> = {
      format: 'game-box.bundle',
      schemaVersion: 2,
      world: world.value,
      quests: [...base.quests, ...doc.quests],
      requires: [...base.requires],
      createdWith: doc.createdWith,
    }
    return Bundle.open({ ...city, contentHash: await contentHash(city) }, have)
  }
}

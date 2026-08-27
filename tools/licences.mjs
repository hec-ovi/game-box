/**
 * What we are allowed to ship, in one place.
 *
 * A world file hands assets to other players by design, so a licence that
 * forbids redistributing the file is unusable here whatever the model costs.
 * See docs/DECISIONS.md D12. `tools/fetch-assets.mjs` gates downloads on this
 * and `tools/fit-model.mjs` gates what it will write.
 */

/** Licences whose files we may put inside a world. */
export const ALLOWED = new Set(['CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0'])

/** Licences that ask for a credit line where one is shown. */
const CREDITED = new Set(['CC-BY-4.0'])

/**
 * The licence out of a glTF's own metadata, as an SPDX id where we know one.
 * Sketchfab writes `asset.extras.license` as "CC-BY-4.0 (http://...)" or
 * "SKETCHFAB Standard (https://...)", so the id is the first word.
 */
export function licenceOf(document) {
  const extras = document.getRoot().getAsset().extras ?? {}
  const said = String(extras.license ?? '').trim()
  if (!said) return { id: 'unknown', author: extras.author, title: extras.title, source: extras.source }
  return { id: said.split(' (')[0].trim(), author: extras.author, title: extras.title, source: extras.source }
}

/** Whether a file under this licence may go into a pack, and why not when it may not. */
export function mayShip(id) {
  if (ALLOWED.has(id)) return { ok: true, credit: CREDITED.has(id) }
  if (id === 'unknown') return { ok: false, why: 'the file says nothing about its licence' }
  if (id.startsWith('SKETCHFAB')) {
    return { ok: false, why: 'the Sketchfab Standard licence forbids making the file available as a stand-alone file' }
  }
  if (id.includes('NC')) return { ok: false, why: `${id} forbids commercial use` }
  if (id.includes('SA')) return { ok: false, why: `${id} would put its terms on everything it ships beside` }
  return { ok: false, why: `${id} is not on the allowed list` }
}

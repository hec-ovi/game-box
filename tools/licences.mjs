/**
 * What a model file says about its own licence, read in one place.
 *
 * This reads metadata and reports it. What goes into the repository is the
 * owner's call, so nothing here refuses anything. `tools/fetch-assets.mjs`
 * uses ALLOWED to sort the registry's own packs as it downloads them.
 */

/** Licences the registry's packs are expected to carry. */
export const ALLOWED = new Set(['CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0'])

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

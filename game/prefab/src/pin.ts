import type { Plot } from '@gb/world'
import type { Catalogue, Design, Suits } from './catalogue.ts'

/**
 * What a plot is drawn with: the design written into the world file if it
 * carries one, and the catalogue's own pick if it does not.
 *
 * A pin is the whole point of a pack. Growing the catalogue changes what the
 * pick would answer for the shapes it touches, so a city dressed against a
 * newer catalogue would be quietly re-skinned. A pinned plot never asks: it
 * names its model, which way round it goes and where its rooms start, and that
 * is what is drawn, in this version of the art and in every later one.
 *
 * Three ways a pin can fail, and all three fall back to the dressing behind
 * rather than picking again:
 *
 * - the pin names another pack, so this catalogue is not the one that wrote it
 *   and its model ids mean nothing here;
 * - the pack has been grown and no longer holds that model;
 * - the plot's shape is not one this catalogue covers, which is the unpinned
 *   case and was already a fallback.
 *
 * Falling back is visible: a kit building next to a street of prefabs reads as
 * one. Picking a different model instead would look exactly like the city the
 * file describes, which is the failure worth being loud about.
 */
export function designFor(catalogue: Catalogue, plot: Plot, size: { width: number; depth: number }, suits: Suits): Design | undefined {
  const pinned = plot.design
  if (!pinned) return catalogue.design(plot, size, suits)
  if (pinned.pack !== catalogue.pack) return undefined
  if (!catalogue.model(pinned.model)) return undefined
  return { model: pinned.model, mirror: pinned.mirror, rooms: pinned.rooms }
}

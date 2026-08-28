/**
 * The little the quest layer needs to know about a world: whether the things a
 * quest points at exist, and whether a plot it points at is one the player can
 * get into. Anything that can answer these eight questions can be validated
 * against, which keeps quests independent of how a world is built.
 */
export interface WorldView {
  hasNpc(id: string): boolean
  hasPlot(id: string): boolean
  hasInterior(id: string): boolean
  hasItem(id: string): boolean
  hasAnchor(interiorId: string, anchorId: string): boolean
  hasDoor(id: string): boolean
  hasMachine(id: string): boolean
  /** Whether that plot's door opens on somewhere to walk into. Most of a city's plots are solid. */
  opens(plotId: string): boolean
}

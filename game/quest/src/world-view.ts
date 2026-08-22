/**
 * The little the quest layer needs to know about a world: whether the things a
 * quest points at exist. Anything that can answer these five questions can be
 * validated against, which keeps quests independent of how a world is built.
 */
export interface WorldView {
  hasNpc(id: string): boolean
  hasPlot(id: string): boolean
  hasInterior(id: string): boolean
  hasItem(id: string): boolean
  hasAnchor(interiorId: string, anchorId: string): boolean
}

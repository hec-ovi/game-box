/**
 * The little the quest layer needs to know about a world: whether the things a
 * quest points at exist, whether a plot it points at is one the player can get
 * into, and what the city calls them. Anything that can answer these questions
 * can be validated against, which keeps quests independent of how a world is
 * built.
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
  /**
   * What the city calls the thing with that id, in the words a player would
   * recognise: a person, a building, the thing itself, or the building a door
   * or a screen stands in. Ids carry their own kind (`npc_0004`, `plot_0031`),
   * so one question covers all of them.
   *
   * It is what a compiled step's `markerLabel` is written from. Nothing back
   * means the city has no name for that id, and a view that answers nothing at
   * all is a view whose steps carry no marker label: a marker with nothing to
   * say says nothing rather than something wrong.
   */
  nameOf?(id: string): string | undefined
}

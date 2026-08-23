import { err, IdMinter, ok, type Result, type SchemaViolation } from '@gb/kit'
import { CELL, Grid, type Rect } from './grid.ts'
import { checkIntegrity, type IntegrityProblem } from './integrity.ts'
import { METRICS, cellCentre } from './metrics.ts'
import { citySpecContract, type CitySpec } from './model/city-spec.ts'
import { catalogueListContract, plotDesignContract, type AssetPackRef, type PlotDesign } from './model/design.ts'
import type { Premise } from './model/premise.ts'
import { worldContract, type Interior, type Item, type Npc, type Placement, type Plot, type WorldDoc } from './model/schema.ts'
import type { BuildingKind, Facing } from './model/vocabulary.ts'

export type WorldError =
  | { readonly code: 'invalid-document'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'inconsistent-world'; readonly problems: readonly IntegrityProblem[] }
  | { readonly code: 'no-space'; readonly message: string }
  | { readonly code: 'unknown-reference'; readonly message: string }

export interface PlotSpec {
  readonly kind: BuildingKind
  readonly name: string
  readonly rect: Rect
  readonly entrance: { readonly cell: { x: number; y: number }; readonly facing: Facing }
  readonly storeys: number
  readonly style: string
  /** The building it was dressed with, when whoever placed it already knows. */
  readonly design?: PlotDesign
}

/**
 * A city and everyone in it. Holds the data, answers questions about it, and
 * refuses to end up in a state that does not hold together.
 */
export class World {
  #doc: WorldDoc
  #grid: Grid
  #ids: IdMinter

  private constructor(doc: WorldDoc) {
    this.#doc = doc
    this.#grid = Grid.fromRows(doc.grid.rows)
    this.#ids = new IdMinter(doc.idCounters)
  }

  /**
   * An empty city: all land, no streets yet. A spec outside the bounds the
   * world document allows (grid 4-1024 cells a side, theme up to 60 characters)
   * comes back as `invalid-document`, so a city is never built only to fail
   * validation once it has been written to disk.
   */
  static found(spec: CitySpec): Result<World, WorldError> {
    const checked = citySpecContract.parse(spec)
    if (!checked.ok) return err({ code: 'invalid-document', violations: checked.error })
    return ok(new World(blankCity(spec)))
  }

  /** Going: `found` hands the refusal back instead of throwing it. */
  static create(spec: CitySpec): World {
    const made = World.found(spec)
    if (!made.ok) throw new Error(`city spec refused: ${JSON.stringify(made.error)}`)
    return made.value
  }

  /** Parse and check an untrusted document, whoever produced it. */
  static load(value: unknown): Result<World, WorldError> {
    const parsed = worldContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-document', violations: parsed.error })
    const problems = checkIntegrity(parsed.value)
    if (problems.length) return err({ code: 'inconsistent-world', problems })
    return ok(new World(parsed.value))
  }

  get id(): string {
    return this.#doc.id
  }

  get name(): string {
    return this.#doc.name
  }

  get theme(): string {
    return this.#doc.theme
  }

  get seed(): string {
    return this.#doc.seed
  }

  get cellSize(): number {
    return this.#doc.cellSize
  }

  /**
   * The history this city was built against, or nothing when it was founded
   * without one. It is written at founding and never rewritten, so a city that
   * is grown later is grown against the same story it started from.
   */
  premise(): Premise | undefined {
    return this.#doc.premise
  }

  get grid(): Grid {
    return this.#grid
  }

  mintId(kind: string): string {
    return this.#ids.mint(kind)
  }

  plots(): readonly Plot[] {
    return this.#doc.plots
  }

  npcs(): readonly Npc[] {
    return this.#doc.npcs
  }

  items(): readonly Item[] {
    return this.#doc.items
  }

  interiors(): readonly Interior[] {
    return this.#doc.interiors
  }

  placements(): readonly Placement[] {
    return this.#doc.placements
  }

  plot(id: string): Plot | undefined {
    return this.#doc.plots.find((p) => p.id === id)
  }

  npc(id: string): Npc | undefined {
    return this.#doc.npcs.find((n) => n.id === id)
  }

  item(id: string): Item | undefined {
    return this.#doc.items.find((i) => i.id === id)
  }

  interior(id: string): Interior | undefined {
    return this.#doc.interiors.find((i) => i.id === id)
  }

  hasPlot(id: string): boolean {
    return this.plot(id) !== undefined
  }

  hasNpc(id: string): boolean {
    return this.npc(id) !== undefined
  }

  hasItem(id: string): boolean {
    return this.item(id) !== undefined
  }

  hasInterior(id: string): boolean {
    return this.interior(id) !== undefined
  }

  plotsOfKind(kind: BuildingKind): readonly Plot[] {
    return this.#doc.plots.filter((p) => p.kind === kind)
  }

  /** Everyone stationed inside a building. */
  npcsIn(plotId: string): readonly Npc[] {
    const interior = this.#doc.interiors.find((i) => i.plotId === plotId)
    if (!interior) return []
    return this.#doc.npcs.filter((n) => n.station?.interiorId === interior.id)
  }

  /** Where an NPC or plot is, in metres, for pathing and markers. */
  positionOf(id: string): { x: number; z: number } | undefined {
    const plot = this.plot(id)
    if (plot) return cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, this.cellSize)
    const npc = this.npc(id)
    if (npc?.station) {
      const interior = this.interior(npc.station.interiorId)
      const owner = interior && this.plot(interior.plotId)
      if (owner) return cellCentre(owner.entrance.cell.x, owner.entrance.cell.y, this.cellSize)
    }
    return undefined
  }

  /** Free footprints of this size that touch a sidewalk: where new buildings can go. */
  buildSites(w: number, h: number): readonly Rect[] {
    return this.#grid.freeRects(w, h, { touching: 'sidewalk' })
  }

  /** Paint streets and sidewalks. The generator owns the layout; the world owns the grid. */
  paint(rect: Rect, kind: keyof typeof CELL): void {
    this.#grid.fill(rect, kind)
    this.#syncGrid()
  }

  addRoad(nodes: ReadonlyArray<{ id: string; cell: { x: number; y: number } }>, segments: WorldDoc['roads']['segments']): void {
    this.#doc.roads.nodes.push(...nodes)
    this.#doc.roads.segments.push(...segments)
  }

  /** Put a building on empty land and mark its footprint. */
  addPlot(spec: PlotSpec): Result<Plot, WorldError> {
    if (!this.#grid.isAll(spec.rect, ['empty'])) {
      return err({ code: 'no-space', message: `${spec.name}: footprint is not free` })
    }
    let design: PlotDesign | undefined
    if (spec.design) {
      const checked = this.#checkDesign(spec.name, spec.design)
      if (!checked.ok) return checked
      design = checked.value
    }
    const plot: Plot = {
      id: this.mintId('plot'),
      kind: spec.kind,
      name: spec.name,
      rect: spec.rect,
      storeys: spec.storeys,
      entrance: spec.entrance,
      style: spec.style,
      ...(design ? { design } : {}),
    }
    this.#grid.fill(spec.rect, 'building')
    this.#syncGrid()
    this.#doc.plots.push(plot)
    return ok(plot)
  }

  /** The art catalogues this city was designed against. Empty means it records none. */
  catalogues(): readonly AssetPackRef[] {
    return this.#doc.catalogues ?? []
  }

  /**
   * Write down which catalogues this city is being designed against, before
   * any plot is pinned to one. Replaces whatever was recorded before.
   */
  recordCatalogues(refs: readonly AssetPackRef[]): Result<readonly AssetPackRef[], WorldError> {
    const checked = catalogueListContract.parse(refs)
    if (!checked.ok) return err({ code: 'invalid-document', violations: checked.error })
    const orphaned = this.#doc.plots.find((p) => p.design && !checked.value.some((ref) => ref.pack === p.design!.pack))
    if (orphaned) {
      return err({ code: 'unknown-reference', message: `plot ${orphaned.id} is designed against ${orphaned.design!.pack}, which this list drops` })
    }
    this.#doc.catalogues = checked.value
    return ok(checked.value)
  }

  /**
   * Pin what a plot was dressed with, at the moment it was chosen. From then on
   * the file says which model the plot has and nothing re-picks it.
   */
  recordDesign(plotId: string, design: PlotDesign): Result<Plot, WorldError> {
    const plot = this.plot(plotId)
    if (!plot) return err({ code: 'unknown-reference', message: `no plot ${plotId} to pin a design on` })
    const checked = this.#checkDesign(`plot ${plotId}`, design)
    if (!checked.ok) return checked
    plot.design = checked.value
    return ok(plot)
  }

  /** A design is only worth writing down if the city names the catalogue it came from. */
  #checkDesign(who: string, design: PlotDesign): Result<PlotDesign, WorldError> {
    const checked = plotDesignContract.parse(design)
    if (!checked.ok) return err({ code: 'invalid-document', violations: checked.error })
    if (!this.catalogues().some((ref) => ref.pack === checked.value.pack)) {
      return err({ code: 'unknown-reference', message: `${who} is designed against unrecorded catalogue ${checked.value.pack}` })
    }
    return ok(checked.value)
  }

  addInterior(interior: Interior): Result<Interior, WorldError> {
    const plot = this.plot(interior.plotId)
    if (!plot) return err({ code: 'unknown-reference', message: `interior points at missing plot ${interior.plotId}` })
    this.#doc.interiors.push(interior)
    plot.interiorId = interior.id
    return ok(interior)
  }

  addNpc(npc: Npc): Result<Npc, WorldError> {
    if (npc.station && !this.hasInterior(npc.station.interiorId)) {
      return err({ code: 'unknown-reference', message: `npc ${npc.id} is stationed in missing interior` })
    }
    this.#doc.npcs.push(npc)
    return ok(npc)
  }

  addItem(item: Item, placement: Placement): Result<Item, WorldError> {
    if (placement.itemId !== item.id) {
      return err({ code: 'unknown-reference', message: `placement is for ${placement.itemId}, not ${item.id}` })
    }
    this.#doc.items.push(item)
    this.#doc.placements.push(placement)
    return ok(item)
  }

  /** Everything that is wrong with the world right now. Empty means sound. */
  check(): readonly IntegrityProblem[] {
    return checkIntegrity(this.toJSON())
  }

  toJSON(): WorldDoc {
    this.#syncGrid()
    this.#doc.idCounters = this.#ids.snapshot()
    return this.#doc
  }

  #syncGrid(): void {
    this.#doc.grid = { width: this.#grid.width, height: this.#grid.height, rows: [...this.#grid.rows()] }
  }
}

/** The document a founded city starts from: sized, named, seeded and empty. */
function blankCity(spec: CitySpec): WorldDoc {
  const ids = new IdMinter()
  return {
    format: 'game-box.world',
    schemaVersion: 1,
    id: ids.mint('world'),
    name: spec.name,
    theme: spec.theme,
    seed: spec.seed,
    generator: spec.generator ?? { name: 'unset', version: '0' },
    cellSize: spec.cellSize ?? METRICS.cellSize,
    ...(spec.premise ? { premise: spec.premise } : {}),
    grid: {
      width: spec.width,
      height: spec.height,
      rows: new Grid(spec.width, spec.height).rows() as string[],
    },
    roads: { nodes: [], segments: [] },
    plots: [],
    interiors: [],
    npcs: [],
    items: [],
    placements: [],
    idCounters: ids.snapshot(),
  }
}

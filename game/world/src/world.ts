import { err, IdMinter, ok, type Contract, type Result, type SchemaViolation } from '@gb/kit'
import { charterOf, declaredCharters } from './charters/declared.ts'
import { CELL, Grid, type Rect } from './grid.ts'
import { checkIntegrity, type IntegrityProblem } from './integrity.ts'
import { METRICS, cellCentre } from './metrics.ts'
import { PLAYER, type Owner } from './model/access.ts'
import { citySpecContract, type CitySpec } from './model/city-spec.ts'
import { catalogueListContract, plotDesignContract, type AssetPackRef, type PlotDesign } from './model/design.ts'
import type { Asks } from './model/asks.ts'
import type { Premise } from './model/premise.ts'
import { chartersContract, type ResolvedCharter } from './model/resolved.ts'
import type { Finish } from './model/traits.ts'
import {
  interiorContract,
  itemContract,
  npcContract,
  placementContract,
  plotContract,
  plotSpecContract,
  roadsContract,
  worldContract,
  type Door,
  type Furniture,
  type Interior,
  type InteriorInput,
  type Item,
  type ItemInput,
  type Npc,
  type Placement,
  type Plot,
  type PlotSpec,
  type RoadNode,
  type Roads,
  type RoadSegment,
  type WorldDoc,
} from './model/schema.ts'

export type WorldError =
  | { readonly code: 'invalid-document'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'inconsistent-world'; readonly problems: readonly IntegrityProblem[] }
  | { readonly code: 'no-space'; readonly message: string }
  | { readonly code: 'unknown-reference'; readonly message: string }

/** A door, and the interior it is in. */
export interface DoorSite {
  readonly interiorId: string
  readonly door: Door
}

/** A machine, as the piece of furniture that carries it, and the interior it is in. */
export interface MachineSite {
  readonly interiorId: string
  readonly furniture: Furniture
}

/**
 * A city and everyone in it. Holds the data, answers questions about it, and
 * refuses to end up in a state that does not hold together.
 *
 * Every record comes in through `read`, whether it arrives in a file or at
 * runtime: the one reader fills the same defaults, keeps the same key order
 * and refuses the same things at both doors, so a city founded and filled
 * here saves to the bytes it saves to after a load.
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
    const checked = read(citySpecContract, spec)
    if (!checked.ok) return checked
    const doc = read(worldContract, blankCity(checked.value))
    return doc.ok ? ok(new World(doc.value)) : doc
  }

  /** Going: `found` hands the refusal back instead of throwing it. */
  static create(spec: CitySpec): World {
    const made = World.found(spec)
    if (!made.ok) throw new Error(`city spec refused: ${JSON.stringify(made.error)}`)
    return made.value
  }

  /** Parse and check an untrusted document, whoever produced it. */
  static load(value: unknown): Result<World, WorldError> {
    const parsed = read(worldContract, value)
    if (!parsed.ok) return parsed
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

  /** What the city is about in the owner's own words, when they wrote it down. */
  brief(): string | undefined {
    return this.#doc.brief
  }

  /** What else the owner asked for, when they asked for anything. */
  asks(): Asks | undefined {
    return this.#doc.asks
  }

  /** The kinds of place this city has: its own, or the fourteen shipped presets when it declares none. */
  charters(): readonly ResolvedCharter[] {
    return declaredCharters(this.#doc)
  }

  /** What a word means in this city, or nothing when no charter declares it. */
  charter(word: string): ResolvedCharter | undefined {
    return charterOf(this.#doc, word)
  }

  /**
   * Write down the kinds of place this city has, before any plot takes one of
   * their words. Replaces whatever was declared before, and refuses to drop a
   * word a plot already holds.
   */
  recordCharters(charters: readonly ResolvedCharter[]): Result<readonly ResolvedCharter[], WorldError> {
    const checked = read(chartersContract, charters)
    if (!checked.ok) return checked
    const orphaned = this.#doc.plots.find((p) => !checked.value.some((c) => c.word === p.kind))
    if (orphaned) {
      return err({ code: 'unknown-reference', message: `plot ${orphaned.id} is a ${orphaned.kind}, which this list drops` })
    }
    const written = this.#rewrite({ charters: checked.value })
    return written.ok ? ok(checked.value) : written
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

  /** Every building you can walk into, each carrying the finish its rooms are dressed in. */
  interiors(): readonly Interior[] {
    return this.#doc.interiors.map((interior) => this.#dressed(interior))
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
    const found = this.#doc.interiors.find((i) => i.id === id)
    return found && this.#dressed(found)
  }

  /** An interior as it is handed out: a file that left `finish` out reads it off the charter. */
  #dressed(interior: Interior): Interior {
    const finish = this.#finishOf(interior)
    return finish === interior.finish ? interior : { ...interior, finish }
  }

  /** The language an interior's rooms are dressed in: its own, else its charter's. */
  #finishOf(interior: InteriorInput): Finish | undefined {
    return interior.finish ?? this.charter(interior.kind)?.finish
  }

  /** A door anywhere in the city, with the interior it is in. */
  door(doorId: string): DoorSite | undefined {
    for (const interior of this.#doc.interiors) {
      const door = interior.doors.find((d) => d.id === doorId)
      if (door) return { interiorId: interior.id, door }
    }
    return undefined
  }

  /** A machine anywhere in the city, as the piece that carries it, with the interior it is in. */
  machine(machineId: string): MachineSite | undefined {
    for (const interior of this.#doc.interiors) {
      const furniture = interior.furniture.find((f) => f.machine?.id === machineId)
      if (furniture) return { interiorId: interior.id, furniture }
    }
    return undefined
  }

  /** Every interior the player owns, in file order. */
  homes(): readonly Interior[] {
    return this.interiors().filter((interior) => interior.owner === PLAYER)
  }

  /** The player's home: the first interior they own, or nothing when they own none. */
  home(): Interior | undefined {
    return this.homes()[0]
  }

  /** Every plot whose entrance is a subway station: where fast travel boards. */
  stations(): readonly Plot[] {
    return this.#doc.plots.filter((plot) => this.charter(plot.kind)?.transit === 'subway')
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

  hasDoor(doorId: string): boolean {
    return this.door(doorId) !== undefined
  }

  hasMachine(machineId: string): boolean {
    return this.machine(machineId) !== undefined
  }

  plotsOfKind(kind: string): readonly Plot[] {
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

  /** Lay nodes and the segments between them: the drivable graph a car follows. */
  addRoad(nodes: readonly RoadNode[], segments: readonly RoadSegment[]): Result<Roads, WorldError> {
    const checked = read(roadsContract, { nodes, segments })
    if (!checked.ok) return checked
    this.#doc.roads.nodes.push(...checked.value.nodes)
    this.#doc.roads.segments.push(...checked.value.segments)
    return ok(checked.value)
  }

  /** Put a building on empty land and mark its footprint. */
  addPlot(spec: PlotSpec): Result<Plot, WorldError> {
    const checked = read(plotSpecContract, spec)
    if (!checked.ok) return checked
    if (!this.#grid.isAll(checked.value.rect, ['empty'])) {
      return err({ code: 'no-space', message: `${checked.value.name}: footprint is not free` })
    }
    if (!this.charter(checked.value.kind)) {
      return err({ code: 'unknown-reference', message: `${checked.value.name} is a ${checked.value.kind}, which this city declares no charter for` })
    }
    if (checked.value.design) {
      const pinned = this.#pinned(checked.value.name, checked.value.design)
      if (!pinned.ok) return pinned
    }
    const plot: Plot = { id: this.mintId('plot'), ...checked.value }
    this.#grid.fill(plot.rect, 'building')
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
    const checked = read(catalogueListContract, refs)
    if (!checked.ok) return checked
    const orphaned = this.#doc.plots.find((p) => p.design && !checked.value.some((ref) => ref.pack === p.design!.pack))
    if (orphaned) {
      return err({ code: 'unknown-reference', message: `plot ${orphaned.id} is designed against ${orphaned.design!.pack}, which this list drops` })
    }
    const written = this.#rewrite({ catalogues: checked.value })
    return written.ok ? ok(checked.value) : written
  }

  /**
   * Pin what a plot was dressed with, at the moment it was chosen. From then on
   * the file says which model the plot has and nothing re-picks it.
   */
  recordDesign(plotId: string, design: PlotDesign): Result<Plot, WorldError> {
    const plot = this.plot(plotId)
    if (!plot) return err({ code: 'unknown-reference', message: `no plot ${plotId} to pin a design on` })
    const checked = read(plotDesignContract, design)
    if (!checked.ok) return checked
    const pinned = this.#pinned(`plot ${plotId}`, checked.value)
    if (!pinned.ok) return pinned
    return this.#rewritePlot(plot, { design: checked.value })
  }

  /** A design is only worth writing down if the city names the catalogue it came from. */
  #pinned(who: string, design: PlotDesign): Result<PlotDesign, WorldError> {
    if (!this.catalogues().some((ref) => ref.pack === design.pack)) {
      return err({ code: 'unknown-reference', message: `${who} is designed against unrecorded catalogue ${design.pack}` })
    }
    return ok(design)
  }

  /**
   * Open a plot. An interior that brought no `finish` takes its charter's, so
   * the file says what its rooms are dressed in without a reader asking.
   */
  addInterior(interior: InteriorInput): Result<Interior, WorldError> {
    const plot = this.plot(interior.plotId)
    if (!plot) return err({ code: 'unknown-reference', message: `interior points at missing plot ${interior.plotId}` })
    const finish = this.#finishOf(interior)
    const checked = read(interiorContract, finish ? { ...interior, finish } : interior)
    if (!checked.ok) return checked
    const opened = this.#rewritePlot(plot, { interiorId: checked.value.id })
    if (!opened.ok) return opened
    this.#doc.interiors.push(checked.value)
    return ok(checked.value)
  }

  /**
   * Write down whose an interior is: a deed bought makes it the player's. A
   * place with an owner is off the market, so its price comes off with it.
   */
  recordOwner(interiorId: string, owner: Owner): Result<Interior, WorldError> {
    const interior = this.#doc.interiors.find((i) => i.id === interiorId)
    if (!interior) return err({ code: 'unknown-reference', message: `no interior ${interiorId} to own` })
    if (owner !== PLAYER && !this.hasNpc(owner)) {
      return err({ code: 'unknown-reference', message: `interior ${interiorId} cannot belong to missing npc ${owner}` })
    }
    const { forSale: _sold, ...kept } = interior
    const written = read(interiorContract, { ...kept, owner })
    if (!written.ok) return written
    this.#doc.interiors[this.#doc.interiors.indexOf(interior)] = written.value
    return ok(this.#dressed(written.value))
  }

  addNpc(npc: Npc): Result<Npc, WorldError> {
    const checked = read(npcContract, npc)
    if (!checked.ok) return checked
    if (checked.value.station && !this.hasInterior(checked.value.station.interiorId)) {
      return err({ code: 'unknown-reference', message: `npc ${checked.value.id} is stationed in missing interior` })
    }
    this.#doc.npcs.push(checked.value)
    return ok(checked.value)
  }

  addItem(item: ItemInput, placement: Placement): Result<Item, WorldError> {
    const checked = read(itemContract, item)
    if (!checked.ok) return checked
    const placed = read(placementContract, placement)
    if (!placed.ok) return placed
    if (placed.value.itemId !== checked.value.id) {
      return err({ code: 'unknown-reference', message: `placement is for ${placed.value.itemId}, not ${checked.value.id}` })
    }
    this.#doc.items.push(checked.value)
    this.#doc.placements.push(placed.value)
    return ok(checked.value)
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

  /** A field written on the document lands where the file carries it, so the two save alike. */
  #rewrite(patch: Partial<WorldDoc>): Result<WorldDoc, WorldError> {
    const written = read(worldContract, { ...this.#doc, ...patch })
    if (written.ok) this.#doc = written.value
    return written
  }

  /** The same for a field written on a plot: the record is replaced, in key order, where it stands. */
  #rewritePlot(plot: Plot, patch: Partial<Plot>): Result<Plot, WorldError> {
    const written = read(plotContract, { ...plot, ...patch })
    if (written.ok) this.#doc.plots[this.#doc.plots.indexOf(plot)] = written.value
    return written
  }
}

/** One reader at both doors: whatever fails its contract is `invalid-document`, with the paths. */
function read<T>(contract: Contract<T>, value: unknown): Result<T, WorldError> {
  const checked = contract.parse(value)
  return checked.ok ? checked : err({ code: 'invalid-document', violations: checked.error })
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
    ...(spec.charters ? { charters: spec.charters } : {}),
    ...(spec.brief ? { brief: spec.brief } : {}),
    ...(spec.asks ? { asks: spec.asks } : {}),
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

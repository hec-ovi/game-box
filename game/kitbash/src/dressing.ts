import { Greybox, type Dressing, type SurfacePart, type SurfaceSize } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot, World } from '@gb/world'
import * as THREE from 'three'
import { assemble } from './assemble.ts'
import type { PlotCharter } from './charter.ts'
import { massing } from './compose/massing.ts'
import { planBuilding, planWalls, type BuildingSize } from './compose/plan.ts'
import { fixtureParts } from './fixture/build.ts'
import type { KitLibrary } from './kit/library.ts'
import { signsFor } from './signage.ts'
import { buildSigns } from './sign/build.ts'
import type { LightEmitter } from './sign/light.ts'
import { SIGN } from './sign/sign.ts'
import { buildStreetLamps } from './street/lamps.ts'

/**
 * The city dressed in the Downtown kit. It answers for buildings, with the
 * subway entrance on a station's doorstep and the camera over a private door
 * drawn into them, for the shell each of them is from far off, for the ground
 * they stand on and for the lamps along the kerb, and hands everything else to
 * the dressing behind it, because the kit is a street kit: it has no furniture
 * and no people in it.
 */
export class KitDressing implements Dressing {
  readonly #kit: KitLibrary
  readonly #rest: Dressing

  constructor(kit: KitLibrary, rest: Dressing = new Greybox()) {
    this.#kit = kit
    this.#rest = rest
  }

  building(plot: Plot, size: BuildingSize, charter: PlotCharter): THREE.Object3D {
    const plan = planBuilding(plot, size, size.width / plot.rect.w, charter)
    const building = assemble(plan.placements, this.#kit, plot.id, { fixtures: fixtureParts(plan.fixtures) })

    // every sign in the city is one material, so the lot is one more draw
    const signs = buildSigns(plan.signs, this.#kit.material(SIGN.material), plot.id)
    if (signs) building.add(signs)

    // an empty at the doorway, so whoever needs the door does not have to work
    // it out from the geometry again
    const door = new THREE.Object3D()
    door.name = 'door'
    door.position.set(...(plan.door.position as [number, number, number]))
    door.rotation.y = plan.door.rotationY
    building.add(door)
    return building
  }

  /**
   * The same building from far off: its walls, its windows and its roof, on the
   * kit's own materials, with the panes flat.
   *
   * What a shell leaves out is everything only read from the pavement: the
   * signs, the subway entrance and the camera drawn into the walls, and the
   * furnished room behind every pane. `@gb/scene` batches one of these per plot
   * within `SHELL_RADIUS` of the player and asks for the whole `building` only
   * within `DETAIL_RADIUS`, so the far town is one draw per kit material and a
   * fragment of it costs the wall fetch.
   *
   * Over `MASSING.storeys` everything above the shopfront is the kit's own
   * plain course stretched across each wall with the same windows flat on it:
   * a tower's shell is its silhouette and its lit skyline, which is all of it
   * anybody 64 m away can read.
   */
  shell(plot: Plot, size: BuildingSize, charter: PlotCharter): THREE.Object3D {
    const plan = planWalls(plot, size, size.width / plot.rect.w, charter)
    const massed = massing(plan, charter, this.#kit)
    return assemble(massed.placements, this.#kit, plot.id, { far: true, fixtures: massed.parts })
  }

  /**
   * The signs this plot carries, as the one welded mesh `building` hangs on it,
   * or nothing where it carries none.
   *
   * A dressing that draws the buildings some other way still wants the city's
   * signage on them, and every sign in the city is on one material, so this is
   * how it gets them without building a kit building to lift them off.
   */
  signs(plot: Plot, size: BuildingSize, charter: PlotCharter): THREE.Mesh | undefined {
    return buildSigns(signsFor(plot, size, charter), this.#kit.material(SIGN.material), plot.id)
  }

  /**
   * A light for every sign, strip and door lamp on that plot, in the building's
   * own frame, so the walls can be lit from what burns on them.
   */
  lights(plot: Plot, size: BuildingSize, charter: PlotCharter): readonly LightEmitter[] {
    return planBuilding(plot, size, size.width / plot.rect.w, charter).lights
  }

  /**
   * Every street lamp in the city, ready to add beside the city root. Two
   * draws: the posts instanced, every halo in one additive buffer.
   */
  streetlights(world: World, spacing?: number): THREE.Object3D {
    return buildStreetLamps(world, this.#kit, spacing)
  }

  /**
   * Moves the city to an hour of the day: which windows are lit, how brightly
   * they burn, and whether the lamps are on. Two uniform writes, however much
   * of the city is standing. This box holds no clock; call it from whoever does.
   */
  setTime(hours: number): void {
    this.#kit.night.setTime(hours)
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    return this.#rest.prop(prop)
  }

  character(npc: Npc, doing: AnchorKind): THREE.Object3D {
    return this.#rest.character(npc, doing)
  }

  pickup(item: Item): THREE.Object3D {
    return this.#rest.pickup(item)
  }

  ground(kind: CellKind): THREE.Material {
    return this.#kit.ground?.material(kind) ?? this.#rest.ground(kind)
  }

  surface(part: SurfacePart, size: SurfaceSize): THREE.Material {
    return this.#rest.surface(part, size)
  }
}

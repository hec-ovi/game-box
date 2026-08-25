import { Greybox, type Dressing, type SurfacePart, type SurfaceSize } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot, World } from '@gb/world'
import * as THREE from 'three'
import { assemble } from './assemble.ts'
import type { PlotCharter } from './charter.ts'
import { planBuilding, type BuildingSize } from './compose/plan.ts'
import type { KitLibrary } from './kit/library.ts'
import { buildSigns } from './sign/build.ts'
import type { LightEmitter } from './sign/light.ts'
import { SIGN } from './sign/sign.ts'
import { buildStreetLamps } from './street/lamps.ts'

/**
 * The city dressed in the Downtown kit. It answers for buildings, for the
 * ground they stand on and for the lamps along the kerb, and hands everything
 * else to the dressing behind it, because the kit is a street kit: it has no
 * furniture and no people in it.
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
    const building = assemble(plan.placements, this.#kit, plot.id)

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

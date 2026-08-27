import { join } from 'node:path'
import { CAR_SURFACES, type CarSurface } from '../src/pack-layout.ts'
import type { CarModel } from '../src/settings.ts'

/**
 * Where every car in the pack comes from.
 *
 * Two kinds of source. The Quaternius pack ships an OBJ and an MTL per car with
 * its parts named, which `car-source.ts` reads. The rest are single models the
 * owner downloaded, fitted to a street car's budget by `tools/fit-model.mjs`
 * and staged under `assets/src/`, which `car-glb.ts` reads: their parts are
 * named for whoever modelled them, so the wheels are found by shape and the
 * surfaces are read off this table.
 *
 * A staged model must name every material it carries. A re-fit that renames one
 * fails the build here rather than shipping a windscreen painted like a bonnet.
 */

export interface ObjSource {
  readonly kind: 'obj'
}

export interface StagedSource {
  readonly kind: 'staged'
  /** Folder under assets/src. */
  readonly slug: string
  readonly file: string
  /** Which way the model was exported: +1 when its nose already points down +Z. */
  readonly nose: 1 | -1
  /** Every material in the file, by what it is made of. */
  readonly surfaces: Partial<Record<keyof typeof CAR_SURFACES, readonly string[]>>
  /**
   * A model painted with one baked sheet has one material and cannot say what
   * anything is. Set this and the tyres, the rims and the lamps are read off
   * the colour instead: a wheel is dark rubber and bright metal, and a lamp is
   * the only saturated thing on a car whose paint and glass are grey.
   */
  readonly sheet?: boolean
}

export type CarSource = ObjSource | StagedSource

const OBJ: ObjSource = { kind: 'obj' }

export const SOURCE_OF: Readonly<Record<CarModel, CarSource>> = {
  NormalCar1: OBJ,
  NormalCar2: OBJ,
  SUV: OBJ,
  Taxi: OBJ,
  SportsCar: OBJ,
  SportsCar2: OBJ,
  Cop: OBJ,
  GranTurismo: {
    kind: 'staged',
    slug: 'audi-e-tron-gt',
    file: '2018_audi_e-tron_gt_concept.glb',
    nose: 1,
    surfaces: {
      paint: ['CarPaint', 'CarPaint_2', 'gtVehicle_Exterior_mm_ext1'],
      glass: ['D_glass'],
      lamp: ['gtVehicle_Exterior_mm_lights1', 'Glass_light', 'material', 'Emiss'],
      trim: [
        'gtVehicle_Exterior_mm_misc1',
        'gtVehicle_Exterior_mm_chassis1',
        'gtVehicle_Exterior_mm_cab1',
        'gtVehicle_Exterior_mm_tyre_009',
      ],
      metal: ['gtVehicle_Exterior_mm_wheel_009', 'gtVehicle_Exterior_mm_rotor_009', 'gtVehicle_Exterior_mm_badges1'],
    },
  },
  Concept: {
    kind: 'staged',
    slug: 'concept-car-037',
    file: 'free_concept_car_037_-_public_domain_cc0.glb',
    nose: -1,
    surfaces: {
      paint: ['body_color_supra.001'],
      lamp: ['headlightCovers'],
      trim: ['plasticMatte', 'plasticBlur', 'blockers', 'rubber___tires.001', 'tireProtector'],
      metal: ['rims.001', 'chrome', 'metal_1.001'],
    },
  },
  Patrol: {
    kind: 'staged',
    slug: 'carbon-motors-e7',
    file: 'carbon_motors_e7_police_cities_skylines.glb',
    nose: 1,
    surfaces: { paint: ['Scene_-_Root'] },
    sheet: true,
  },
}

/** Which surface each of a staged model's materials is, by name. */
export function surfaceTable(source: StagedSource): Map<string, CarSurface> {
  const table = new Map<string, CarSurface>()
  for (const [surface, names] of Object.entries(source.surfaces)) {
    for (const name of names) table.set(name, CAR_SURFACES[surface as keyof typeof CAR_SURFACES])
  }
  return table
}

/** Where a staged model sits: `<assets/src>/<slug>/<file>`. */
export function stagedFile(source: StagedSource, staging: string): string {
  return join(staging, source.slug, source.file)
}

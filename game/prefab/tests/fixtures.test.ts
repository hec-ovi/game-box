import { Forge, OfflineNarrator } from '@gb/forge'
import { CityNight, DOORLAMP, KitDressing, SIGN, placeholderKit, signsFor, type Sign } from '@gb/kitbash'
import { Greybox, storeyHeight } from '@gb/scene'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { describe, expect, it } from 'vitest'
import { Catalogue } from '../src/catalogue.ts'
import { PrefabDressing, type BuildingSize } from '../src/dressing.ts'
import { DOOR_FINISH } from '../src/entrance.ts'
import type { StreetFace } from '../src/face.ts'
import { laidOn } from '../src/fixtures.ts'
import { Library } from '../src/library.ts'
import { designFor } from '../src/pin.ts'
import { ROOM_PICTURES } from '../src/rooms.ts'
import { SCREEN_PICTURES } from '../src/screens.ts'
import { middleOf, seatedSigns, signPoints, type SeatedSign } from '../tools/signage.ts'

/**
 * A prefab building drawn on the shipped pack, dressed with the signage the kit
 * writes for its plot, over a forged town.
 *
 * The kit writes a fixture against the plot: a door snapped to its own 2 m
 * module, its own door's width and head, and a wall plane on the plot boundary.
 * The pack draws its entrance in the middle of the front at its own size, and
 * stands its fascia band and its screen plates 8 cm off that plane, which is
 * exactly where a flat sign lands. So what is proved here is that every fixture
 * ends up on the surface it belongs to and never in the same plane as it.
 */
const pack = new URL('../pack/', import.meta.url)
const catalogue = await Catalogue.read(new Uint8Array(readFileSync(new URL('buildings.json', pack))))
const mesh = readFileSync(new URL('buildings.glb', pack))
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength), '')
const grey = (count: number) => new THREE.DataArrayTexture(new Uint8Array(4 * 4 * count * 4).fill(128), 4, 4, count)
const finishes = catalogue.atlas.finishes
const atlas = { colour: grey(finishes.length), emissive: grey(finishes.length), rooms: grey(ROOM_PICTURES.length), screens: grey(SCREEN_PICTURES.length), finishes }
const library = Library.of({ catalogue, scenes: gltf.scenes, atlas, night: new CityNight() })
const kit = new KitDressing(placeholderKit('a neon port city'), new Greybox())
const dressing = new PrefabDressing(library, kit)

const built = await new Forge(new OfflineNarrator('fixtures')).build({ theme: 'a neon port city', seed: 'fixtures', blocksX: 4, blocksY: 4, density: 1, maxStoreys: 4, openPlaces: 12 })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world

interface Dressed {
  readonly id: string
  readonly size: BuildingSize
  readonly face: StreetFace
  readonly seated: readonly SeatedSign[]
  readonly orphans: number
}

/** Every plot of the town the pack answers for, dressed once by the kit and once by the prefab. */
const town: Dressed[] = []
for (const plot of world.plots()) {
  const charter = world.charter(plot.kind)!
  const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) }
  if (!designFor(catalogue, plot, size, charter.suits)) continue
  const signs = signsFor(plot, size, charter) as readonly Sign[]
  const written = signPoints(kit.building(plot, size, charter))
  const hung = signPoints(dressing.building(plot, size, charter))
  const face = dressing.face(plot, size, charter)!
  const read = seatedSigns(written, hung, signs, face)
  town.push({ id: plot.id, size, face, seated: read.seated, orphans: read.orphans })
}

/** Only what is on the wall the entrance is on: a blade on a flank is the kit's own wall and its own arithmetic. */
function onTheFront(dressed: Dressed, of: (one: SeatedSign) => boolean): SeatedSign[] {
  return dressed.seated.filter((one) => one.sign.wall === dressed.face.wall && of(one))
}

describe('seating the kit’s fixtures on the building the pack drew', () => {
  it('dresses a town of prefabs with signage on every one of them', () => {
    expect(town.length).toBeGreaterThan(40)
    expect(town.every((dressed) => dressed.seated.length > 0)).toBe(true)
    // every vertex of a building's signage belongs to one of its signs, so none is left where it was written
    expect(town.reduce((sum, dressed) => sum + dressed.orphans, 0)).toBe(0)
  })

  it('publishes the entrance the pack drew, not the one the plot asks for', () => {
    for (const dressed of town) {
      const door = dressed.face.door
      expect(door, dressed.id).toBeDefined()
      // the door is on the wall the entrance faces, at the middle of the front
      expect(Math.abs(middleOf(door!, dressed.face)), dressed.id).toBeLessThan(0.001)
      expect(door!.width).toBeGreaterThan(1)
      expect(door!.position[1] + door!.height / 2).toBeGreaterThan(2)
      // and it is the plate the geometry carries, not a number from the plot
      expect(finishes.indexOf(DOOR_FINISH)).toBeGreaterThanOrEqual(0)
    }
  })

  it('stands both door lamps on the drawn door: beside its frame, from the pavement to its head', () => {
    let lamps = 0
    for (const dressed of town) {
      const door = dressed.face.door!
      const middle = middleOf(door, dressed.face)
      const head = door.position[1] + door.height / 2
      const pair = onTheFront(dressed, (one) => one.sign.kind === 'doorlamp')
      expect(pair.length, dressed.id).toBe(2)
      for (const lamp of pair) {
        lamps++
        const off = Math.abs((lamp.across[0] + lamp.across[1]) / 2 - middle)
        expect(off, dressed.id).toBeCloseTo(door.width / 2 + DOORLAMP.beside + DOORLAMP.width / 2, 3)
        expect(lamp.up[0], dressed.id).toBeCloseTo(DOORLAMP.foot, 3)
        expect(lamp.up[1], dressed.id).toBeCloseTo(head + DOORLAMP.overhead, 3)
      }
      // and the pair straddles the door rather than standing on it
      expect(Math.max(...pair.map((lamp) => lamp.across[0])), dressed.id).toBeGreaterThan(middle + door.width / 2)
      expect(Math.min(...pair.map((lamp) => lamp.across[1])), dressed.id).toBeLessThan(middle - door.width / 2)
    }
    expect(lamps).toBeGreaterThan(80)
  })

  it('lays every plate on the face the model really has under it, so no two surfaces share a plane', () => {
    let plates = 0
    for (const dressed of town) {
      for (const one of onTheFront(dressed, (sign) => sign.sign.mount === 'flat' && sign.sign.kind !== 'doorlamp' && laidOn(sign.sign, dressed.face))) {
        plates++
        const relief = dressed.face.reliefUnder(one.across, one.up)
        expect(one.out - dressed.face.plane - relief, `${dressed.id} ${one.sign.kind}`).toBeCloseTo(SIGN.stand, 3)
      }
    }
    expect(plates).toBeGreaterThan(80)
  })

  it('leaves a sign the kit did not lay on a wall exactly where it wrote it', () => {
    // the lit box over a subway entrance stands out on the doorstep in front of
    // the wall, so carrying it onto the face would put it through the stairs
    const standing = town.flatMap((dressed) => dressed.seated.filter((one) => !laidOn(one.sign, dressed.face)))
    expect(standing.length).toBeGreaterThan(0)
    for (const one of standing) expect(one.moved, one.sign.kind).toBe(0)
  })

  it('leaves a box hung over the street hanging over it, bracket on the wall', () => {
    let hung = 0
    for (const dressed of town) {
      for (const one of onTheFront(dressed, (sign) => sign.sign.mount === 'hung' && laidOn(sign.sign, dressed.face))) {
        hung++
        // its bracket meets the wall and its panel reaches out over the pavement, never back into the building
        expect(one.out - dressed.face.plane, dressed.id).toBeGreaterThanOrEqual(SIGN.stand - 0.001)
      }
    }
    expect(hung).toBeGreaterThan(10)
  })

  it('moves the light a lamp throws with the lamp', () => {
    for (const plot of world.plots()) {
      const charter = world.charter(plot.kind)!
      const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) }
      if (!designFor(catalogue, plot, size, charter.suits)) continue
      dressing.building(plot, size, charter)
      const face = dressing.face(plot, size, charter)!
      const door = face.door!
      const middle = middleOf(door, face)
      const across = face.wall === 'north' || face.wall === 'south' ? 0 : 2
      const lit = dressing.lights(plot, size, charter).filter((light) => light.kind === 'doorlamp')
      expect(lit.length, plot.id).toBe(2)
      for (const light of lit) {
        expect(Math.abs(light.position[across] - middle), plot.id).toBeCloseTo(door.width / 2 + DOORLAMP.beside + DOORLAMP.width / 2, 3)
      }
    }
  })
})

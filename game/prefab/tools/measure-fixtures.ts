/**
 * Where the signage `@gb/kitbash` writes for a plot lands on the building the
 * pack actually drew, measured headless in Node over a forged town: how far
 * every door lamp is from the drawn door it lights, and how far a plate laid
 * flat on a wall stands off the model's own face under it.
 *
 *   node tools/measure-fixtures.ts [--seed metro] [--blocks 4]
 */
import { Forge, OfflineNarrator } from '@gb/forge'
import { CityNight, DOORLAMP, KitDressing, SIGN, placeholderKit, signsFor, type Sign } from '@gb/kitbash'
import { Greybox, storeyHeight } from '@gb/scene'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { Catalogue } from '../src/catalogue.ts'
import { PrefabDressing } from '../src/dressing.ts'
import { Library } from '../src/library.ts'
import { designFor } from '../src/pin.ts'
import { ROOM_PICTURES } from '../src/rooms.ts'
import { SCREEN_PICTURES } from '../src/screens.ts'
import { flag } from './args.ts'
import { axesOf } from '../src/face.ts'
import { laidOn } from '../src/fixtures.ts'
import { middleOf, seatedSigns, signPoints } from './signage.ts'

const args = process.argv.slice(2)
const seed = flag(args, '--seed') ?? 'metro'
const blocks = Number(flag(args, '--blocks') ?? 4)

const pack = new URL('../pack/', import.meta.url)
const catalogue = await Catalogue.read(new Uint8Array(readFileSync(new URL('buildings.json', pack))))
const mesh = readFileSync(new URL('buildings.glb', pack))
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength), '')
const layers = (count: number) => new THREE.DataArrayTexture(new Uint8Array(4 * 4 * count * 4).fill(128), 4, 4, count)
const finishes = catalogue.atlas.finishes
const atlas = { colour: layers(finishes.length), emissive: layers(finishes.length), rooms: layers(ROOM_PICTURES.length), screens: layers(SCREEN_PICTURES.length), finishes }
const library = Library.of({ catalogue, scenes: gltf.scenes, atlas, night: new CityNight() })
const kit = new KitDressing(placeholderKit('a neon port city'), new Greybox())
const dressing = new PrefabDressing(library, kit)

const built = await new Forge(new OfflineNarrator(seed)).build({ theme: 'a neon port city', seed, blocksX: blocks, blocksY: blocks, density: 1, maxStoreys: 4, openPlaces: 12 })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world

const lampSide: number[] = []
const lampHead: number[] = []
const lampFoot: number[] = []
const flatStand: number[] = []
let plots = 0
let prefabs = 0
let orphans = 0
let coplanar = 0
let onBand = 0
let overBand = 0
const reach: number[] = []
const stoodOff: string[] = []

for (const plot of world.plots()) {
  plots++
  const charter = world.charter(plot.kind)!
  const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) }
  if (!designFor(catalogue, plot, size, charter.suits)) continue
  prefabs++
  const signs = signsFor(plot, size, charter) as readonly Sign[]
  const written = signPoints(kit.building(plot, size, charter))
  const hung = signPoints(dressing.building(plot, size, charter))
  const face = dressing.face(plot, size, charter)!
  const read = seatedSigns(written, hung, signs, face)
  orphans += read.orphans

  for (const one of read.seated) {
    if (one.sign.wall !== face.wall) continue
    const door = face.door
    if (one.sign.kind === 'doorlamp' && door) {
      lampSide.push(Math.abs(Math.abs((one.across[0] + one.across[1]) / 2 - middleOf(door, face)) - door.width / 2 - DOORLAMP.beside - DOORLAMP.width / 2))
      lampHead.push(one.up[1] - (door.position[1] + door.height / 2 + DOORLAMP.overhead))
      lampFoot.push(one.up[0] - DOORLAMP.foot)
      continue
    }
    reach.push(Math.round((one.out - face.plane) * 1000) / 1000)
    if (!laidOn(one.sign, face)) {
      const wrote = one.sign.origin[axesOf(one.sign.wall).across === 'x' ? 0 : 2]
      stoodOff.push(`${one.sign.kind} moved ${Math.abs((one.across[0] + one.across[1]) / 2 - wrote).toFixed(3)} m along, standing ${(one.out - face.plane).toFixed(3)} m out`)
      continue
    }
    if (one.sign.mount !== 'flat') continue
    const stand = one.out - face.plane - face.reliefUnder(one.across, one.up)
    flatStand.push(Math.round(stand * 1000) / 1000)
    if (Math.abs(stand) < 0.001) coplanar++

    const band = face.band
    if (!band) continue
    const middle = middleOf(band, face)
    const [low, high] = [band.position[1] - band.height / 2, band.position[1] + band.height / 2]
    if (one.across[0] < middle - band.width / 2 || one.across[1] > middle + band.width / 2) continue
    if (Math.min(one.up[1], high) - Math.max(one.up[0], low) < (one.up[1] - one.up[0]) / 2) continue
    onBand++
    if (one.up[1] - one.up[0] > band.height + 0.001) overBand++
  }
}

const stat = (name: string, values: number[]) => {
  if (!values.length) return console.log(`${name}: none`)
  const sorted = [...values].sort((a, b) => a - b)
  console.log(`${name}: n=${sorted.length} min ${sorted[0]!.toFixed(3)} p50 ${sorted[Math.floor(sorted.length / 2)]!.toFixed(3)} max ${sorted.at(-1)!.toFixed(3)}`)
}
console.log(`pack ${catalogue.version}, ${blocks} by ${blocks} blocks, seed ${seed}: ${plots} plots, ${prefabs} on the pack`)
console.log(`sign vertices in no sign's patch: ${orphans}`)
stat(`lamp middle off ${DOORLAMP.beside} m outside the drawn door frame`, lampSide)
stat(`lamp head against the drawn door head plus ${DOORLAMP.overhead}`, lampHead)
stat(`lamp foot against ${DOORLAMP.foot}`, lampFoot)
stat(`plate standing off the model's own face under it (${SIGN.stand} wanted)`, flatStand)
console.log(`plates in the same plane as the face under them: ${coplanar}/${flatStand.length}`)
console.log(`plates written on a fascia band: ${onBand}, of which taller than the band: ${overBand}`)
stat('how far a seated plate stands past the plot boundary', reach)
console.log(`signs the kit did not lay on the wall, so left where they were: ${stoodOff.length}${stoodOff.length ? ` -> ${[...new Set(stoodOff)].join('; ')}` : ''}`)

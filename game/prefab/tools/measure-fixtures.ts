/**
 * Where the signage `@gb/kitbash` writes for a plot lands on the building the
 * pack actually drew, measured headless in Node: how far every door lamp is
 * from the drawn door it lights, and how far a plate laid flat on a wall stands
 * off the model's own face under it. Both sides of it are arithmetic, the
 * plot's and the model's, so nothing here needs a city that has been written.
 *
 * The street is `tools/town.ts`: every model in the pack on a plot cut to its
 * own shape, under the fourteen kinds of place a city ships. What a kind is
 * decides how much signage the kit writes and of what sort, so a street of one
 * kind carries a nameplate and two door lamps and measures none of the fixtures
 * the seating exists for.
 *
 * Both columns come off one run. The kit's own signage is read against the same
 * drawn face the seated one is, so what separates the two is the seat and
 * nothing else, and a seating that did nothing would print two identical blocks.
 *
 *   node tools/measure-fixtures.ts
 */
import { DOORLAMP, KitDressing, SIGN, placeholderKit, signsFor, type Sign } from '@gb/kitbash'
import { Greybox } from '@gb/scene'
import { PrefabDressing } from '../src/dressing.ts'
import { axesOf, type StreetFace } from '../src/face.ts'
import { laidOn } from '../src/fixtures.ts'
import { readPack } from './headless.ts'
import { middleOf, seatedSigns, signPoints, type SeatedSign } from './signage.ts'
import { packTown } from './town.ts'

const library = await readPack()
const catalogue = library.catalogue
const kit = new KitDressing(placeholderKit('a neon port city'), new Greybox())
const dressing = new PrefabDressing(library, kit)
const town = packTown(catalogue)

/** Where one town's fixtures ended up, on one dressing: everything a column of the table is read off. */
class Landing {
  readonly lampSide: number[] = []
  readonly lampHead: number[] = []
  readonly lampFoot: number[] = []
  readonly flatStand: number[] = []
  readonly reach: number[] = []
  coplanar = 0
  onBand = 0
  /** Every plate taller than the band it is written on, as the two heights, so the mismatch says its own size. */
  readonly overBand: string[] = []

  /** One building's signs, each measured against the face the model really drew under it. */
  read(seated: readonly SeatedSign[], face: StreetFace): void {
    for (const one of seated) {
      if (one.sign.wall !== face.wall) continue
      const door = face.door
      if (one.sign.kind === 'doorlamp' && door) {
        this.lampSide.push(Math.abs(Math.abs((one.across[0] + one.across[1]) / 2 - middleOf(door, face)) - door.width / 2 - DOORLAMP.beside - DOORLAMP.width / 2))
        this.lampHead.push(one.up[1] - (door.position[1] + door.height / 2 + DOORLAMP.overhead))
        this.lampFoot.push(one.up[0] - DOORLAMP.foot)
        continue
      }
      this.reach.push(round(one.out - face.plane))
      if (!laidOn(one.sign, face) || one.sign.mount !== 'flat') continue

      const stand = one.out - face.plane - face.reliefUnder(one.across, one.up)
      this.flatStand.push(round(stand))
      if (Math.abs(stand) < 0.001) this.coplanar++

      const band = face.band
      if (!band) continue
      const middle = middleOf(band, face)
      const [low, high] = [band.position[1] - band.height / 2, band.position[1] + band.height / 2]
      if (one.across[0] < middle - band.width / 2 || one.across[1] > middle + band.width / 2) continue
      if (Math.min(one.up[1], high) - Math.max(one.up[0], low) < (one.up[1] - one.up[0]) / 2) continue
      this.onBand++
      const tall = one.up[1] - one.up[0]
      if (tall > band.height + 0.001) this.overBand.push(`a ${tall.toFixed(3)} m plate on a ${band.height.toFixed(3)} m band`)
    }
  }

  print(name: string): void {
    console.log(`  ${name}:`)
    stat(`    lamp middle off ${DOORLAMP.beside} m outside the drawn door frame`, this.lampSide)
    stat(`    lamp head against the drawn door head plus ${DOORLAMP.overhead}`, this.lampHead)
    stat(`    lamp foot against ${DOORLAMP.foot}`, this.lampFoot)
    stat(`    plate standing off the model's own face under it (${SIGN.stand} wanted)`, this.flatStand)
    console.log(`    plates in the same plane as the face under them: ${this.coplanar}/${this.flatStand.length}`)
    console.log(`    plates written on a fascia band: ${this.onBand}, of which taller than the band: ${this.overBand.length}${this.overBand.length ? ` -> ${[...new Set(this.overBand)].join('; ')}` : ''}`)
    stat('    how far a plate stands past the plot boundary', this.reach)
  }
}

const written = new Landing()
const seated = new Landing()
const stoodOff: string[] = []
let plots = 0
let prefabs = 0
let orphans = 0

for (const { plot, size, charter } of town) {
  plots++
  const face = dressing.face(plot, size, charter)
  if (!face) continue
  prefabs++
  const signs = signsFor(plot, size, charter) as readonly Sign[]
  const wrote = signPoints(kit.building(plot, size, charter))
  const hung = signPoints(dressing.building(plot, size, charter))

  const onTheFace = seatedSigns(wrote, hung, signs, face)
  orphans += onTheFace.orphans
  seated.read(onTheFace.seated, face)
  // the same signs where the kit put them: the vertices are their own start, so
  // this is the column the seat has to beat
  written.read(seatedSigns(wrote, wrote, signs, face).seated, face)

  for (const one of onTheFace.seated) {
    if (one.sign.wall !== face.wall || laidOn(one.sign, face)) continue
    const at = one.sign.origin[axesOf(one.sign.wall).across === 'x' ? 0 : 2]
    stoodOff.push(`${one.sign.kind} moved ${Math.abs((one.across[0] + one.across[1]) / 2 - at).toFixed(3)} m along, standing ${(one.out - face.plane).toFixed(3)} m out`)
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function stat(name: string, values: readonly number[]): void {
  if (!values.length) return console.log(`${name}: none`)
  const sorted = [...values].sort((a, b) => a - b)
  console.log(`${name}: n=${sorted.length} min ${sorted[0]!.toFixed(3)} p50 ${sorted[Math.floor(sorted.length / 2)]!.toFixed(3)} max ${sorted.at(-1)!.toFixed(3)}`)
}

console.log(`pack ${catalogue.version}: ${plots} plots, ${prefabs} on the pack`)
console.log(`sign vertices in no sign's patch: ${orphans}`)
written.print('as the kit wrote it, against the plot')
seated.print('seated on the face the model drew')
console.log(`signs the kit did not lay on the wall, so left where they were: ${stoodOff.length}${stoodOff.length ? ` -> ${[...new Set(stoodOff)].join('; ')}` : ''}`)

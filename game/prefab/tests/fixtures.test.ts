import { DOORLAMP, KitDressing, SIGN, placeholderKit, signsFor, type Sign } from '@gb/kitbash'
import { Greybox } from '@gb/scene'
import { describe, expect, it } from 'vitest'
import { PrefabDressing } from '../src/dressing.ts'
import type { StreetFace } from '../src/face.ts'
import { laidOn } from '../src/fixtures.ts'
import { readPack } from '../tools/headless.ts'
import { middleOf, seatedSigns, signPoints, type SeatedSign } from '../tools/signage.ts'
import { packTown, type Site } from '../tools/town.ts'

/**
 * A prefab building drawn on the shipped pack, dressed with the signage the kit
 * writes for its plot.
 *
 * The kit writes a fixture against the plot: a door snapped to its own 2 m
 * module, its own door's width and head, and a wall plane on the plot boundary.
 * The pack draws its entrance in the middle of the front at its own size, and
 * stands its fascia band and its screen plates 8 cm off that plane, which is
 * exactly where a flat sign lands. So what is proved here is that every fixture
 * ends up on the surface it belongs to and never in the same plane as it.
 *
 * The street is the pack itself (`tools/town.ts`): every model on a plot cut to
 * its own shape, under the fourteen kinds of place a city ships. Which fixtures
 * the kit writes is what a kind of place decides, so a town of one kind carries
 * one nameplate and two door lamps and says nothing about a blade on a flank, a
 * box hung over the street or the lit box on a station's doorstep.
 */
const library = await readPack()
const kit = new KitDressing(placeholderKit('a neon port city'), new Greybox())
const dressing = new PrefabDressing(library, kit)

interface Dressed extends Site {
  readonly face: StreetFace
  readonly seated: readonly SeatedSign[]
  readonly orphans: number
}

/** Every building of the street, dressed once by the kit and once by the prefab. */
const town: Dressed[] = packTown(library.catalogue).map((site) => {
  const { plot, size, charter } = site
  const signs = signsFor(plot, size, charter) as readonly Sign[]
  const written = signPoints(kit.building(plot, size, charter))
  const hung = signPoints(dressing.building(plot, size, charter))
  const face = dressing.face(plot, size, charter)
  if (!face) throw new Error(`${plot.id} is pinned to ${site.model.id}, which this pack holds at this shape, and was not drawn from it`)
  const read = seatedSigns(written, hung, signs, face)
  return { ...site, face, seated: read.seated, orphans: read.orphans }
})

/** How far off a metre read back out of the pack may be: the mesh is quantized on the way in. */
const QUANTIZED = 0.005

/** Every seated sign in the street that answers, with the building it stands on, so a count says what it counted. */
function across(of: (one: SeatedSign, dressed: Dressed) => boolean): Array<{ dressed: Dressed; one: SeatedSign }> {
  return town.flatMap((dressed) => dressed.seated.filter((one) => of(one, dressed)).map((one) => ({ dressed, one })))
}

/** On the wall the entrance is on: a blade on a flank is the kit's own wall and its own arithmetic. */
const onTheFront = (one: SeatedSign, dressed: Dressed) => one.sign.wall === dressed.face.wall

describe('seating the kit’s fixtures on the building the pack drew', () => {
  it('dresses every model in the pack with the signage its kind of place hangs on it', () => {
    expect(town.length).toBe(library.catalogue.models.length)
    expect(town.every((dressed) => dressed.seated.length > 0)).toBe(true)
    // every vertex of a building's signage belongs to one of its signs, so none is left where it was written
    expect(town.reduce((sum, dressed) => sum + dressed.orphans, 0)).toBe(0)
    // and the street carries every fixture the kit writes, which is what the
    // tests below are measured over: a plate, a tube, a box hung out over the
    // pavement, the pair at the door and the lit box on a station's doorstep
    const carried = new Set(across(() => true).map(({ one }) => `${one.sign.kind}/${one.sign.mount}`))
    expect([...carried].sort()).toEqual(['doorlamp/flat', 'sign/flat', 'sign/hung', 'strip/flat', 'subway/flat'])
  })

  it('publishes the entrance the pack drew, not the one the plot asks for', () => {
    const widths = new Set<number>()
    for (const dressed of town) {
      const door = dressed.face.door
      expect(door, dressed.plot.id).toBeDefined()
      // the door is on the wall the entrance faces, at the middle of the front
      expect(Math.abs(middleOf(door!, dressed.face)), dressed.plot.id).toBeLessThan(0.001)
      // at the size the model drew it, which is nothing the plot could have
      // said: the kit's own door is 0.95 m wide with its head at 2.10 m
      expect(door!.width, dressed.plot.id).toBeGreaterThanOrEqual(1.2 - QUANTIZED)
      expect(door!.width, dressed.plot.id).toBeLessThanOrEqual(2.4 + QUANTIZED)
      const head = door!.position[1] + door!.height / 2
      expect(head, dressed.plot.id).toBeGreaterThanOrEqual(2.3 - QUANTIZED)
      expect(head, dressed.plot.id).toBeLessThanOrEqual(2.9 + QUANTIZED)
      widths.add(Math.round(door!.width * 1000))
    }
    // a number read off the plot would be one number; the pack's doors are many
    expect(widths.size).toBeGreaterThan(1)
  })

  it('stands both door lamps on the drawn door: beside its frame, from the pavement to its head', () => {
    let lamps = 0
    for (const dressed of town) {
      const door = dressed.face.door!
      const middle = middleOf(door, dressed.face)
      const head = door.position[1] + door.height / 2
      const pair = dressed.seated.filter((one) => onTheFront(one, dressed) && one.sign.kind === 'doorlamp')
      expect(pair.length, dressed.plot.id).toBe(2)
      for (const lamp of pair) {
        lamps++
        const off = Math.abs((lamp.across[0] + lamp.across[1]) / 2 - middle)
        expect(off, dressed.plot.id).toBeCloseTo(door.width / 2 + DOORLAMP.beside + DOORLAMP.width / 2, 3)
        expect(lamp.up[0], dressed.plot.id).toBeCloseTo(DOORLAMP.foot, 3)
        expect(lamp.up[1], dressed.plot.id).toBeCloseTo(head + DOORLAMP.overhead, 3)
      }
      // and the pair straddles the door rather than standing on it
      expect(Math.max(...pair.map((lamp) => lamp.across[0])), dressed.plot.id).toBeGreaterThan(middle + door.width / 2)
      expect(Math.min(...pair.map((lamp) => lamp.across[1])), dressed.plot.id).toBeLessThan(middle - door.width / 2)
    }
    expect(lamps).toBe(2 * town.length)
  })

  it('lays every plate on the face the model really has under it, so no two surfaces share a plane', () => {
    const plates = across(
      (one, dressed) => onTheFront(one, dressed) && one.sign.mount === 'flat' && one.sign.kind !== 'doorlamp' && laidOn(one.sign, dressed.face),
    )
    for (const { dressed, one } of plates) {
      const relief = dressed.face.reliefUnder(one.across, one.up)
      expect(one.out - dressed.face.plane - relief, `${dressed.plot.id} ${one.sign.kind}`).toBeCloseTo(SIGN.stand, 3)
    }
    // every building carries its name over the door, and the loud ones carry a
    // tube or a board as well, so this is more than the nameplates
    expect(plates.length).toBeGreaterThan(town.length)
    expect(new Set(plates.map(({ one }) => one.sign.kind))).toEqual(new Set(['sign', 'strip']))
  })

  it('leaves a sign the kit did not lay on a wall exactly where it wrote it', () => {
    // a blade on a flank is the kit's own wall and its own arithmetic, and the
    // lit box over a subway entrance stands out on the doorstep in front of the
    // wall, so carrying it onto the face would put it through the stairs
    const standing = across((one, dressed) => !laidOn(one.sign, dressed.face))
    expect(standing.filter(({ one }) => one.sign.kind === 'subway').length).toBeGreaterThan(0)
    expect(standing.filter(({ one }) => one.sign.kind !== 'subway').length).toBeGreaterThan(0)
    for (const { one } of standing) expect(one.moved, one.sign.kind).toBe(0)
  })

  it('leaves a box hung over the street hanging over it, bracket on the wall', () => {
    const boxes = across((one, dressed) => onTheFront(one, dressed) && one.sign.mount === 'hung' && laidOn(one.sign, dressed.face))
    // its bracket meets the wall and its panel reaches out over the pavement, never back into the building
    for (const { dressed, one } of boxes) expect(one.out - dressed.face.plane, dressed.plot.id).toBeGreaterThanOrEqual(SIGN.stand - 0.001)
    expect(boxes.length).toBeGreaterThan(100)
  })

  it('moves the light a lamp throws with the lamp', () => {
    // `building` has already been asked for every plot above, which is what
    // decides whether the kit's signs were hung and so whether their lights are
    for (const { plot, size, charter, face } of town) {
      const door = face.door!
      const middle = middleOf(door, face)
      const along = face.wall === 'north' || face.wall === 'south' ? 0 : 2
      const lit = dressing.lights(plot, size, charter).filter((light) => light.kind === 'doorlamp')
      expect(lit.length, plot.id).toBe(2)
      for (const light of lit) {
        expect(Math.abs(light.position[along] - middle), plot.id).toBeCloseTo(door.width / 2 + DOORLAMP.beside + DOORLAMP.width / 2, 3)
      }
    }
  })
})

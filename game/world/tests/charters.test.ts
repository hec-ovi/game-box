import { describe, expect, it } from 'vitest'
import {
  BUILDING_KINDS,
  HOLDING_ARCHETYPES,
  ITEM_ARCHETYPES,
  MAX_CHARTERS,
  ROOM_USES,
  roomUseOf,
  SHIPPED_CHARTERS,
  World,
  type Interior,
  type ResolvedCharter,
  type Room,
} from '../src/index.ts'

/** A place no preset knows, written the way a generator would and resolved the way the forge would. */
function jail(over: Partial<ResolvedCharter> = {}): ResolvedCharter {
  return {
    word: 'jail',
    label: 'jail',
    blade: 'JAIL',
    names: ['{family} Holding', 'The {adjective} {noun} House'],
    rumours: ['Somebody went in last spring and has not come out.'],
    share: 1,
    prominence: 'landmark',
    residential: false,
    size: { storeys: [2, 3], sprawl: 'block' },
    street: { frontage: 'blank', openness: 'sparse', material: 'masonry', voice: 'sober' },
    access: 'admitted',
    service: 'desk',
    work: ['watch', 'desk'],
    holding: ['papers', 'personal'],
    finish: 'civic',
    rooms: {
      hall: { use: 'waiting-room', name: 'Duty desk' },
      main: { use: 'ward', name: 'Cell row' },
      services: [{ use: 'private-office', name: 'Warden office', weight: 1, shut: true }],
    },
    built: {
      street: { plain: 'Brick_BottomTrim', window: 'Brick_BottomTrim', rhythm: 3 },
      flank: { plain: 'Brick_BottomTrim', window: 'Brick_BottomTrim', rhythm: 3 },
      upper: { plain: 'Brick_Plain_3', window: 'Brick_Plain_3', rhythm: 3 },
      crown: 'Brick_TopTrim',
      fascia: 'Brick_Plain_1',
      door: 'DoorFrame_Metal_Single',
    },
    signage: { blade: 0.34, hanging: 0, accents: 1, nameplate: 0.75 },
    tint: 0x6a6a6a,
    suits: ['jail', 'blank', 'masonry', 'block', 'landmark'],
    ...over,
  }
}

const spec = { name: 'Holding', theme: 'grim', seed: 'c1', width: 16, height: 16 }
const site = { rect: { x: 2, y: 1, w: 4, h: 4 }, entrance: { cell: { x: 3, y: 5 }, facing: 'south' as const }, storeys: 2, style: 'kit' }

function town(charters: readonly ResolvedCharter[]): World {
  const world = World.create({ ...spec, charters })
  world.paint({ x: 0, y: 5, w: 16, h: 1 }, 'sidewalk')
  return world
}

describe('the kinds of place a city has', () => {
  it('reads the fourteen presets, in the order a mix has always drawn them, into a city that declares none', () => {
    const world = World.create(spec)
    expect(world.charters().map((c) => c.word)).toEqual([...BUILDING_KINDS])
    expect(SHIPPED_CHARTERS.map((c) => c.word)).toEqual([...BUILDING_KINDS])
    expect('charters' in world.toJSON()).toBe(false)

    const bar = world.charter('bar')
    expect(bar?.blade).toBe('BAR')
    expect(bar?.built.street.plain).toBe('Trim_FirstFloor_Wall')
    expect(bar?.signage).toEqual({ blade: 0.72, hanging: 0.8, accents: 4, nameplate: 1 })
    expect(bar?.tint).toBe(0x8c5a3c)
    expect(world.charter('jail')).toBeUndefined()
  })

  it('takes a charter the premise invented, and refuses a plot whose word no charter declares', () => {
    const world = town([jail()])
    expect(world.addPlot({ ...site, kind: 'jail', name: 'Holding House' }).ok).toBe(true)
    expect(world.plotsOfKind('jail')).toHaveLength(1)

    const stray = world.addPlot({ ...site, rect: { x: 8, y: 1, w: 4, h: 4 }, entrance: { cell: { x: 9, y: 5 }, facing: 'south' }, kind: 'bar', name: 'The Nail' })
    expect(stray.ok).toBe(false)
    if (!stray.ok) expect(stray.error.code).toBe('unknown-reference')

    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    doc.plots[0].kind = 'prison'
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (loaded.ok || loaded.error.code !== 'inconsistent-world') throw new Error('expected inconsistent-world')
    expect(loaded.error.problems[0]?.message).toContain('names no charter')
  })

  it('normalises charters as they are read, so a model that reorders or dithers cannot move a building', () => {
    const dithered = jail({ share: 40, signage: { blade: 0.70000001, hanging: 1.4, accents: 9, nameplate: 0.5 }, work: ['watch', 'desk'], suits: ['masonry', 'jail'] })
    const archive = jail({ word: 'archive', blade: 'ARCHIVE', suits: ['archive'] })
    const world = World.create({ ...spec, charters: [dithered, archive] })

    const read = world.charters()
    expect(read.map((c) => c.word)).toEqual(['archive', 'jail'])
    const kept = world.charter('jail')!
    expect(kept.share).toBe(10)
    expect(kept.signage).toEqual({ blade: 0.7, hanging: 1, accents: 4, nameplate: 0.5 })
    expect(kept.work).toEqual(['desk', 'watch'])
    expect(kept.suits).toEqual(['jail', 'masonry'])
    expect(Object.keys(kept)).toEqual([...Object.keys(kept)].sort())

    const again = World.load(JSON.parse(JSON.stringify(world.toJSON())))
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.value.charters()).toEqual(read)

    const twice = World.found({ ...spec, charters: [jail(), jail()] })
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.error.code).toBe('invalid-document')
  })

  it('refuses a charter that names anything outside the closed lists, so nothing new is ever named', () => {
    const outside: Array<[string, unknown]> = [
      ['street', { frontage: 'glass', openness: 'dense', material: 'metal', voice: 'loud' }],
      ['built', { ...jail().built, door: 'Door_Fancy' }],
      ['blade', 'jail'],
      ['names', ['{city} Jail']],
      ['rooms', { main: { use: 'cell-block', name: 'Cells' }, services: [] }],
    ]
    for (const [field, value] of outside) {
      const made = World.found({ ...spec, charters: [{ ...jail(), [field]: value }] as never })
      expect(made.ok, field).toBe(false)
      if (made.ok || made.error.code !== 'invalid-document') throw new Error(`expected ${field} refused`)
      expect(made.error.violations.map((v) => v.path).join(' ')).toContain(field)
    }
  })

  it('refuses a charter stripped to its word, so a reader never re-derives what the file should carry', () => {
    const { built, signage, tint, suits, ...bare } = jail()
    const made = World.found({ ...spec, charters: [bare] as never })
    expect(made.ok).toBe(false)
    if (made.ok || made.error.code !== 'invalid-document') throw new Error('expected invalid-document')
    const paths = made.error.violations.map((v) => v.path).join(' ')
    for (const field of ['built', 'signage', 'tint', 'suits']) expect(paths).toContain(field)
    expect(built.door && signage.accents >= 0 && tint >= 0 && suits.length > 0).toBe(true)

    const tooMany = World.found({ ...spec, charters: Array.from({ length: MAX_CHARTERS + 1 }, (_, i) => jail({ word: `place-${i}` })) })
    expect(tooMany.ok).toBe(false)
  })

  it('records charters on a founded city, and refuses to drop a word a plot holds', () => {
    const world = town([jail()])
    expect(world.addPlot({ ...site, kind: 'jail', name: 'Holding House' }).ok).toBe(true)

    const dropped = world.recordCharters([jail({ word: 'archive', blade: 'ARCHIVE' })])
    expect(dropped.ok).toBe(false)
    if (!dropped.ok) expect(dropped.error.code).toBe('unknown-reference')

    const grown = world.recordCharters([jail(), jail({ word: 'archive', blade: 'ARCHIVE' })])
    expect(grown.ok).toBe(true)
    const reloaded = World.load(JSON.parse(JSON.stringify(world.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (reloaded.ok) expect(reloaded.value.charters().map((c) => c.word)).toEqual(['archive', 'jail'])
  })
})

describe('where fast travel boards', () => {
  it('lists the plots whose charter makes the entrance a subway station, and carries the mark through a save', () => {
    const world = World.create(spec)
    world.paint({ x: 0, y: 5, w: 16, h: 1 }, 'sidewalk')
    const halt = world.addPlot({ ...site, kind: 'station', name: 'Ridge Halt' })
    const bar = world.addPlot({ ...site, rect: { x: 8, y: 1, w: 4, h: 4 }, entrance: { cell: { x: 9, y: 5 }, facing: 'south' }, kind: 'bar', name: 'The Nail' })
    if (!halt.ok || !bar.ok) throw new Error('fixture')
    expect(world.stations().map((p) => p.id)).toEqual([halt.value.id])
    expect(world.charter('station')?.transit).toBe('subway')
    expect(world.charter('bar')?.transit).toBeUndefined()

    const underground = town([jail({ transit: 'subway' })])
    const cells = underground.addPlot({ ...site, kind: 'jail', name: 'Holding House' })
    if (!cells.ok) throw new Error('fixture')
    const reloaded = World.load(JSON.parse(JSON.stringify(underground.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (reloaded.ok) expect(reloaded.value.stations().map((p) => p.id)).toEqual([cells.value.id])
    expect(town([jail()]).stations()).toEqual([])

    const tram = World.found({ ...spec, charters: [jail({ transit: 'tram' as never })] })
    expect(tram.ok).toBe(false)
    if (!tram.ok) expect(tram.error.code).toBe('invalid-document')
  })
})

describe('what a room is for and what a person there is doing', () => {
  const rect = { x: 0, y: 0, w: 6, h: 6 }

  it('reads a use off a room that carries one, and off its label through the charter for a file written before', () => {
    const cellar: Room = { id: 'room_0001', kind: 'cellar', name: 'Cellar', rect }
    const bar = SHIPPED_CHARTERS.find((c) => c.word === 'bar')!
    const hotel = SHIPPED_CHARTERS.find((c) => c.word === 'hotel')!
    const house = SHIPPED_CHARTERS.find((c) => c.word === 'house')!
    expect(roomUseOf(cellar, bar)).toBe('store')
    expect(roomUseOf({ ...cellar, kind: 'bedroom' }, hotel)).toBe('guest-room')
    expect(roomUseOf({ ...cellar, kind: 'bedroom' }, house)).toBe('bedroom')
    expect(roomUseOf({ ...cellar, kind: 'office' }, house)).toBe('private-office')
    expect(roomUseOf({ ...cellar, use: 'ward' }, house)).toBe('ward')
    for (const charter of SHIPPED_CHARTERS) {
      for (const use of ROOM_USES) expect(ROOM_USES).toContain(roomUseOf({ ...cellar, kind: 'main', use }, charter))
    }
  })

  it('carries a room use and an anchor phrase through a save, and refuses a use no routine has', () => {
    const world = town([jail()])
    const plot = world.addPlot({ ...site, kind: 'jail', name: 'Holding House' })
    if (!plot.ok) throw new Error('plot')
    const interior: Interior = {
      id: world.mintId('interior'),
      plotId: plot.value.id,
      kind: 'jail',
      size: { w: 8, h: 8 },
      rooms: [{ id: world.mintId('room'), kind: 'main', use: 'ward', name: 'Cell row', rect }],
      doors: [],
      furniture: [],
      anchors: [],
    }
    const roomId = interior.rooms[0]!.id
    interior.doors.push({ id: world.mintId('door'), from: 'outside', to: roomId, pos: { x: 4, y: 0 }, rot: 180, locked: false })
    interior.anchors.push({ id: world.mintId('anchor'), kind: 'guard', roomId, pos: { x: 1, y: 1 }, rot: 0, doing: 'watching the cell row' })
    expect(world.addInterior(interior).ok).toBe(true)

    const reloaded = World.load(JSON.parse(JSON.stringify(world.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    const back = reloaded.value.interior(interior.id)!
    expect(back.rooms[0]?.use).toBe('ward')
    expect(back.anchors[0]?.doing).toBe('watching the cell row')

    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    doc.interiors[0].rooms[0].use = 'cell-block'
    const refused = World.load(doc)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.code).toBe('invalid-document')
  })
})

describe('the finish a building is dressed in', () => {
  it('writes the charter\'s finish into a new interior, and reads it back into a file that left it out', () => {
    const world = town([jail()])
    const plot = world.addPlot({ ...site, kind: 'jail', name: 'Holding House' })
    if (!plot.ok) throw new Error('plot')
    const roomId = world.mintId('room')
    const interior: Interior = {
      id: world.mintId('interior'),
      plotId: plot.value.id,
      kind: 'jail',
      size: { w: 8, h: 8 },
      rooms: [{ id: roomId, kind: 'main', use: 'ward', name: 'Cell row', rect: { x: 0, y: 0, w: 8, h: 8 } }],
      doors: [{ id: world.mintId('door'), from: 'outside', to: roomId, pos: { x: 4, y: 0 }, rot: 180, locked: false }],
      furniture: [],
      anchors: [],
    }
    expect(world.addInterior(interior).ok).toBe(true)
    expect(world.interior(interior.id)?.finish).toBe('civic')
    expect(world.toJSON().interiors[0]?.finish).toBe('civic')

    // a file written before interiors carried a finish keeps its bytes and still reads one
    const before = JSON.parse(JSON.stringify(world.toJSON()))
    delete before.interiors[0].finish
    const loaded = World.load(JSON.parse(JSON.stringify(before)))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.interiors().map((i) => i.finish)).toEqual(['civic'])
    expect('finish' in loaded.value.toJSON().interiors[0]!).toBe(false)

    before.interiors[0].finish = 'baroque'
    const refused = World.load(before)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.code).toBe('invalid-document')
  })
})

describe('what a holding is made of', () => {
  it('puts every archetype in exactly one class', () => {
    const placed = Object.values(HOLDING_ARCHETYPES).flat()
    expect([...placed].sort()).toEqual([...ITEM_ARCHETYPES].sort())
    expect(new Set(placed).size).toBe(placed.length)
  })
})

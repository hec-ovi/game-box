import { Forge, OfflineNarrator } from '@gb/forge'
import { World, type CellKind } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildLand, matchTheme, THEMES, type Land } from '../src/index.ts'

async function town(theme = 'quiet valley town', seed = 'land'): Promise<World> {
  const built = await new Forge(new OfflineNarrator(seed)).build({
    theme,
    seed,
    blocksX: 1,
    blocksY: 1,
    blockCells: 14,
  })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value.world
}

function landOf(world: World, options: Parameters<typeof buildLand>[1] = {}): Land {
  const built = buildLand(world, options)
  if (!built.ok) throw new Error(JSON.stringify(built.error))
  return built.value
}

/** Which cell of the grid a point in metres falls on, or undefined off the map. */
function cellAt(world: World, x: number, z: number): CellKind | undefined {
  return world.grid.at(Math.floor(x / world.cellSize), Math.floor(z / world.cellSize))
}

function instances(mesh: THREE.InstancedMesh): THREE.Vector3[] {
  const matrix = new THREE.Matrix4()
  const out: THREE.Vector3[] = []
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix)
    out.push(new THREE.Vector3().setFromMatrixPosition(matrix))
  }
  return out
}

/** Rounded position stream: two landscapes are the same when this is. */
function shape(land: Land): string {
  const position = land.terrain.geometry.getAttribute('position')
  let digest = 0
  for (let i = 0; i < position.count; i++) {
    digest = (digest * 31 + Math.round((position.getX(i) + position.getY(i) * 7 + position.getZ(i) * 13) * 100)) % 1e12
  }
  return `${position.count}:${digest}:${land.cost.trees}:${land.cost.ponds}`
}

describe('terrain', () => {
  it('grows out of the mountain cells and never lies over the town', async () => {
    const world = await town()
    const land = landOf(world)
    const position = land.terrain.geometry.getAttribute('position')
    const index = land.terrain.geometry.getIndex()!

    const covered = new Set<string>()
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      let x = 0
      let z = 0
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index.getX(triangle + corner)
        x += position.getX(vertex) / 3
        z += position.getZ(vertex) / 3
      }
      const kind = cellAt(world, x, z)
      // a face is either out beyond the map or on a mountain cell: never on the town
      expect(kind === undefined || kind === 'mountain').toBe(true)
      if (kind === 'mountain') covered.add(`${Math.floor(x / world.cellSize)},${Math.floor(z / world.cellSize)}`)
    }
    expect(covered.size).toBe(world.grid.count('mountain'))
  })

  it('rises out of the valley floor and keeps going to the horizon', async () => {
    const world = await town()
    const land = landOf(world)
    const middle = (world.grid.width * world.cellSize) / 2

    // level where the town is, climbing away from it, still there far out
    expect(land.heightAt(middle, middle)).toBe(0)
    const climb = [8, 40, 100, 180].map((away) => land.heightAt(middle, -away))
    for (let i = 1; i < climb.length; i++) expect(climb[i]!).toBeGreaterThan(climb[i - 1]!)
    expect(climb.at(-1)!).toBeGreaterThan(40)

    const bounds = new THREE.Box3().setFromObject(land.terrain)
    expect(bounds.min.x).toBeLessThan(-land.horizon)
    expect(bounds.max.x).toBeGreaterThan(world.grid.width * world.cellSize + land.horizon)
  })

  it('is one welded mesh, wound to be seen from above', async () => {
    const world = await town()
    const land = landOf(world)
    const position = land.terrain.geometry.getAttribute('position')
    const index = land.terrain.geometry.getIndex()!

    const seen = new Set<string>()
    for (let i = 0; i < position.count; i++) seen.add(`${Math.round(position.getX(i))}:${Math.round(position.getZ(i))}`)
    // one vertex per place: the skirt shares the band's edge instead of cracking away from it
    expect(seen.size).toBe(position.count)

    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      a.fromBufferAttribute(position, index.getX(triangle))
      b.fromBufferAttribute(position, index.getX(triangle + 1))
      c.fromBufferAttribute(position, index.getX(triangle + 2))
      const facing = b.clone().sub(a).cross(c.clone().sub(a))
      expect(facing.y).toBeGreaterThan(0)
    }
  })
})

describe('the road out', () => {
  it('stays at ground level through the pass and beyond the map', async () => {
    const world = await town()
    const land = landOf(world)
    const cell = world.cellSize
    const { width, height } = world.grid

    const exits: Array<{ x: number; y: number }> = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
        if (edge && world.grid.at(x, y) === 'street') exits.push({ x, y })
      }
    }
    expect(exits.length).toBeGreaterThan(0)

    for (const exit of exits) {
      const x = (exit.x + 0.5) * cell
      const z = (exit.y + 0.5) * cell
      expect(land.heightAt(x, z)).toBe(0)
      for (let out = 4; out <= 50; out += 6) {
        const ox = exit.x === 0 ? -out : exit.x === width - 1 ? width * cell + out : x
        const oz = exit.y === 0 ? -out : exit.y === height - 1 ? height * cell + out : z
        expect(land.heightAt(ox, oz)).toBe(0)
      }
    }
  })
})

describe('water', () => {
  it('sits in the ground it is surrounded by, and never in the town', async () => {
    const world = await town()
    const land = landOf(world)
    expect(land.water).toBeDefined()

    const position = land.water!.geometry.getAttribute('position')
    const index = land.water!.geometry.getIndex()!
    const centres = new Map<number, THREE.Vector3>()
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const first = index.getX(triangle)
      centres.set(first, new THREE.Vector3().fromBufferAttribute(position, first))
    }
    expect(centres.size).toBe(land.cost.ponds)

    for (const [, centre] of centres) {
      // the bed is under the surface
      expect(land.heightAt(centre.x, centre.z)).toBeLessThan(centre.y)
      expect(land.waterAt(centre.x, centre.z)).toBeCloseTo(centre.y, 4)
    }

    const rim = new THREE.Vector3()
    const outward = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) {
      rim.fromBufferAttribute(position, i)
      const kind = cellAt(world, rim.x, rim.z)
      expect(kind === undefined || kind === 'mountain').toBe(true)

      const centre = [...centres.values()].reduce((near, other) =>
        other.distanceTo(rim) < near.distanceTo(rim) ? other : near,
      )
      if (centre.equals(rim)) continue
      // under water at the edge of the surface, and the shore closing right beyond it
      expect(land.heightAt(rim.x, rim.z)).toBeLessThan(rim.y)
      outward.subVectors(rim, centre).normalize()
      const shore = Array.from({ length: 20 }, (_, step) => (step + 1) * 0.05).some(
        (out) => land.heightAt(rim.x + outward.x * out, rim.z + outward.z * out) >= rim.y,
      )
      expect(shore).toBe(true)
    }
  })
})

describe('trees', () => {
  it('grow on the land and nowhere near the town, the road or the water', async () => {
    const world = await town()
    const land = landOf(world)
    expect(land.trees.length).toBeGreaterThan(0)
    expect(land.cost.trees).toBeGreaterThan(50)

    for (const wood of land.trees) {
      for (const spot of instances(wood)) {
        const kind = cellAt(world, spot.x, spot.z)
        expect(kind === undefined || kind === 'mountain').toBe(true)
        expect(land.waterAt(spot.x, spot.z)).toBeUndefined()
        // standing on the ground, not floating over it or sunk in it
        expect(spot.y).toBeCloseTo(land.heightAt(spot.x, spot.z), 3)
        expect(spot.y).toBeLessThanOrEqual(land.theme.trees.treeLine)
      }
    }
  })
})

describe('the same seed', () => {
  it('builds the same land, and another seed builds another', async () => {
    const world = await town()
    expect(shape(landOf(world))).toBe(shape(landOf(world)))
    expect(shape(landOf(world))).not.toBe(shape(landOf(world, { seed: 'somewhere else' })))
  })
})

describe('themes', () => {
  it('are read from the world and change the land', async () => {
    const world = await town()
    const wet = landOf(world, { theme: 'maritime' })
    const dry = landOf(world, { theme: 'arid' })

    expect(shape(wet)).not.toBe(shape(dry))
    expect(wet.fog.far).toBeLessThan(dry.fog.far)
    expect(wet.cost.ponds).toBeGreaterThan(dry.cost.ponds)
    expect(wet.trees.map((wood) => wood.name)).not.toEqual(dry.trees.map((wood) => wood.name))
  })

  it('are matched from whatever the world calls itself', () => {
    expect(matchTheme('dusty western mining town').id).toBe('arid')
    expect(matchTheme('rain-soaked port').id).toBe('maritime')
    // a theme nobody wrote a landscape for still builds one
    expect(THEMES.map((theme) => theme.id)).toContain(matchTheme('a town of glass towers').id)
  })

  it('refuse a name nobody registered', async () => {
    const built = buildLand(await town(), { theme: 'lunar' })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.error.code).toBe('unknown-theme')
  })
})

describe('a map with no town on it', () => {
  it('is refused, because there is no valley to grow land around', () => {
    const walled = World.create({ name: 'walled in', theme: 'nowhere', seed: 'walled', width: 12, height: 12 })
    walled.paint({ x: 0, y: 0, w: 12, h: 12 }, 'mountain')

    const built = buildLand(walled)
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.error.code).toBe('no-valley')
  })
})

describe('cost', () => {
  it('stays background: a handful of draws and a few thousand triangles', async () => {
    const land = landOf(await town('rain-soaked port'))

    expect(land.cost.draws).toBeLessThanOrEqual(6)
    expect(land.cost.triangles).toBeLessThan(20000)
    expect(land.cost.trees).toBeLessThanOrEqual(land.theme.trees.max)
    // the whole landscape is the terrain, the water, the woods and the sky
    expect(land.root.children.filter((child) => child instanceof THREE.Mesh).length).toBeLessThanOrEqual(6)
  })
})

describe('the sky', () => {
  it('carries a sun, hangs behind everything and hazes to its own colour', async () => {
    const land = landOf(await town())

    expect(land.sky.renderOrder).toBeLessThan(0)
    expect(land.sun.position.y).toBeGreaterThan(0)
    expect(land.fog.color.getHex()).toBe(land.theme.light.haze)
    expect(land.fog.far).toBeGreaterThan(land.fog.near)
    // far enough back that the whole dome is inside a camera set up from it
    expect(land.cameraFar).toBeGreaterThan(land.horizon)
  })
})

describe('time of day', () => {
  it('puts the sun up at noon and down at midnight, with the moon opposite it', async () => {
    const land = landOf(await town())

    land.setTime(12)
    expect(land.sun.position.y).toBeGreaterThan(0)
    expect(land.sun.intensity).toBeGreaterThan(land.theme.light.sunIntensity * 0.9)
    expect(land.moon.intensity).toBe(0)

    land.setTime(0)
    expect(land.sun.position.y).toBeLessThan(0)
    expect(land.sun.intensity).toBe(0)
    expect(land.moon.position.y).toBeGreaterThan(0)
    expect(land.moon.intensity).toBeGreaterThan(0)

    // and it comes back round: 06:00 is the sun on the horizon, east of town
    land.setTime(6)
    expect(land.sun.position.y).toBeCloseTo(0, 6)
    expect(land.sun.position.x).toBeGreaterThan(land.moon.position.x)
  })

  it('runs off the end of the clock and wraps', async () => {
    const land = landOf(await town())
    land.setTime(30)
    expect(land.time).toBe(6)
    land.setTime(-3)
    expect(land.time).toBe(21)
  })

  it('makes night about five times dimmer than noon, and never black', async () => {
    const land = landOf(await town())
    const lit = (): number => land.sun.intensity + land.moon.intensity + land.skyLight.intensity

    land.setTime(12)
    const noon = lit()
    land.setTime(0)
    const midnight = lit()

    expect(noon / midnight).toBeGreaterThan(3)
    expect(noon / midnight).toBeLessThan(8)
    // a street you can still walk down and read
    expect(midnight).toBeGreaterThan(0.8)
    expect(land.moon.intensity).toBeGreaterThan(0.2)
  })

  it('brings the stars and the moon out at night and takes them away by day', async () => {
    const land = landOf(await town())
    const moonDisc = land.root.getObjectByName('land:moon-disc')!

    land.setTime(1)
    expect(land.stars.visible).toBe(true)
    expect((land.stars.material as THREE.PointsMaterial).opacity).toBeGreaterThan(0.9)
    expect(moonDisc.visible).toBe(true)

    land.setTime(13)
    expect(land.stars.visible).toBe(false)
    expect(moonDisc.visible).toBe(false)
  })

  it('moves the light without rebuilding a single vertex of the land', async () => {
    const land = landOf(await town())
    const geometry = land.terrain.geometry
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const version = position.version
    const trees = land.trees.map((wood) => wood.geometry)

    for (const hour of [0, 4, 7, 12, 18, 22]) land.setTime(hour)
    land.setWeather('rain')
    land.setWeather('clear')

    expect(land.terrain.geometry).toBe(geometry)
    expect(land.terrain.geometry.getAttribute('position')).toBe(position)
    expect(position.version).toBe(version)
    expect(land.trees.map((wood) => wood.geometry)).toEqual(trees)
  })
})

describe('weather', () => {
  it('moves the light and the haze the way each one says', async () => {
    const land = landOf(await town())
    land.setTime(12)

    const look = (): { sun: number; ambient: number; near: number; far: number; haze: number; wet: number } => ({
      sun: land.sun.intensity,
      ambient: land.skyLight.intensity,
      near: land.fog.near,
      far: land.fog.far,
      haze: land.fog.color.getHex(),
      wet: land.wetness,
    })

    land.setWeather('clear')
    const clear = look()
    land.setWeather('overcast')
    const overcast = look()
    land.setWeather('rain')
    const wet = look()

    // the sun goes out of it and the haze closes in, step by step
    expect(clear.sun).toBeGreaterThan(overcast.sun)
    expect(overcast.sun).toBeGreaterThan(wet.sun)
    expect(clear.far).toBeGreaterThan(overcast.far)
    expect(overcast.far).toBeGreaterThan(wet.far)
    expect(clear.near).toBeGreaterThan(wet.near)
    // flatter, not darker: what the sun loses the sky puts back
    expect(overcast.ambient).toBeGreaterThan(clear.ambient)
    expect(new Set([clear.haze, overcast.haze, wet.haze]).size).toBe(3)
    expect(clear.wet).toBe(0)
    expect(wet.wet).toBeGreaterThan(overcast.wet)
  })

  it('rains inside a volume around the viewer and nowhere else', async () => {
    const land = landOf(await town())
    const rain = land.rain as THREE.LineSegments
    const drawn = (): number => rain.geometry.drawRange.count

    land.setWeather('clear')
    expect(drawn()).toBe(0)
    expect(rain.visible).toBe(false)

    land.setWeather('rain')
    expect(rain.visible).toBe(true)
    expect(drawn()).toBe(land.cost.drops * 2)

    const viewer = new THREE.Vector3(30, 1.7, 30)
    const position = rain.geometry.getAttribute('position')
    // walk a while, so any drop that would trail behind has had the chance to
    for (let frame = 0; frame < 90; frame++) {
      viewer.x += 0.05
      viewer.z += 0.02
      land.update(1 / 60, viewer)
    }

    const half = land.rainVolume.clone().multiplyScalar(0.5)
    for (let vertex = 0; vertex < drawn(); vertex++) {
      // the streak is drawn from the drop back along its fall, so it reaches a
      // little past the box it belongs to
      expect(Math.abs(position.getX(vertex) - viewer.x)).toBeLessThanOrEqual(half.x + 0.7)
      expect(Math.abs(position.getZ(vertex) - viewer.z)).toBeLessThanOrEqual(half.z + 0.7)
      expect(position.getY(vertex)).toBeGreaterThanOrEqual(viewer.y - 5.7)
      expect(position.getY(vertex)).toBeLessThanOrEqual(viewer.y + 15.7)
    }
  })
})

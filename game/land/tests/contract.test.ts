import { Forge, OfflineNarrator } from '@gb/forge'
import { World, type CellKind } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildLand, matchTheme, SHADOW_LAYER, THEMES, type Land } from '../src/index.ts'

const towns = new Map<string, Promise<World>>()

/** Forging a city is slow, so each one is built once and read many times. */
function town(theme = 'quiet valley town', seed = 'land'): Promise<World> {
  const key = `${theme}/${seed}`
  let made = towns.get(key)
  if (!made) {
    made = new Forge(new OfflineNarrator(seed))
      .build({ theme, seed, blocksX: 1, blocksY: 1, blockCells: 14 })
      .then((built) => {
        if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
        return built.value.world
      })
    towns.set(key, made)
  }
  return made
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

function middleOf(world: World): { x: number; z: number } {
  return { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
}

/** Points on a circle of this radius around the middle of town. */
function around(world: World, radius: number, steps = 24): Array<{ x: number; z: number }> {
  const middle = middleOf(world)
  return Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2
    return { x: middle.x + Math.cos(angle) * radius, z: middle.z + Math.sin(angle) * radius }
  })
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

/**
 * The state the stars and the moon were stuck in: a blended material is drawn
 * after every solid object in the frame, so with the depth test off it covers
 * walls, cars and people whatever its `renderOrder` says.
 */
function paintsOverEverything(object: THREE.Object3D): boolean {
  const material = (object as THREE.Mesh).material as THREE.Material | undefined
  if (!material) return false
  return material.transparent === true && material.depthTest === false
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

describe('the open ground', () => {
  it('runs a kilometre in every direction before anything rises', async () => {
    const world = await town()
    const land = landOf(world)

    // level where the town is, and still low ground a kilometre out
    expect(land.heightAt(middleOf(world).x, middleOf(world).z)).toBe(0)
    for (const spot of around(world, 1000)) {
      expect(Math.abs(land.heightAt(spot.x, spot.z))).toBeLessThan(110)
    }
    // and rolling rather than a table: hills and dips, not one flat height
    const heights = around(world, 700, 64).map((spot) => land.heightAt(spot.x, spot.z))
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(25)
  })

  it('can be walked, all the way out', async () => {
    const world = await town()
    const land = landOf(world)

    let walkable = 0
    let total = 0
    for (let radius = 60; radius <= 1200; radius += 60) {
      for (const spot of around(world, radius, 36)) {
        total++
        if (land.walkableAt(spot.x, spot.z)) walkable++
      }
    }
    expect(walkable / total).toBeGreaterThan(0.95)
  })

  it('keeps the high ground kilometres away, where you would not walk to it', async () => {
    const world = await town()
    const land = landOf(world)

    const mean = (radius: number): number => {
      const heights = around(world, radius, 32).map((spot) => land.heightAt(spot.x, spot.z))
      return heights.reduce((sum, height) => sum + height, 0) / heights.length
    }

    expect(mean(1200)).toBeLessThan(80)
    expect(mean(2000)).toBeGreaterThan(mean(1200))
    // and it really is a mountain by the time you get there
    expect(mean(2900)).toBeGreaterThan(300)
    expect(land.horizon).toBeGreaterThan(4000)
  })
})

describe('terrain', () => {
  it('covers the verge the grid marks and never lies over the town', async () => {
    const world = await town()
    const land = landOf(world)
    const position = land.terrain.geometry.getAttribute('position')
    const index = land.terrain.geometry.getIndex()!

    const covered = new Set<string>()
    let overTown = 0
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      let x = 0
      let z = 0
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index.getX(triangle + corner)
        x += position.getX(vertex) / 3
        z += position.getZ(vertex) / 3
      }
      const kind = cellAt(world, x, z)
      if (kind !== undefined && kind !== 'mountain') overTown++
      if (kind === 'mountain') covered.add(`${Math.floor(x / world.cellSize)},${Math.floor(z / world.cellSize)}`)
    }
    expect(overTown).toBe(0)
    expect(covered.size).toBe(world.grid.count('mountain'))
  })

  it('is one welded mesh, wound to be seen from above', async () => {
    const world = await town()
    const land = landOf(world)
    const position = land.terrain.geometry.getAttribute('position')
    const index = land.terrain.geometry.getIndex()!

    const seen = new Set<string>()
    for (let i = 0; i < position.count; i++) seen.add(`${Math.round(position.getX(i))}:${Math.round(position.getZ(i))}`)
    // one vertex per place: the coarse steps share the fine ones' edges rather
    // than cracking away from them
    expect(seen.size).toBe(position.count)

    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    let facingDown = 0
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      a.fromBufferAttribute(position, index.getX(triangle))
      b.fromBufferAttribute(position, index.getX(triangle + 1))
      c.fromBufferAttribute(position, index.getX(triangle + 2))
      if (b.clone().sub(a).cross(c.clone().sub(a)).y <= 0) facingDown++
    }
    expect(facingDown).toBe(0)
  })

  it('answers the height query with the very ground it draws', async () => {
    const world = await town()
    const land = landOf(world)
    const caster = new THREE.Raycaster()
    caster.far = 6000
    const down = new THREE.Vector3(0, -1, 0)

    // a line straight out of town, which crosses every seam between one step of
    // resolution and the next
    const middle = middleOf(world)
    let checked = 0
    let worst = 0
    for (let away = 60; away < 2600; away += 64) {
      caster.set(new THREE.Vector3(middle.x, 3000, middle.z - away), down)
      const hit = caster.intersectObject(land.terrain, false)[0]
      expect(hit).toBeDefined()
      checked++
      worst = Math.max(worst, Math.abs(hit!.point.y - land.heightAt(middle.x, middle.z - away)))
    }
    expect(checked).toBeGreaterThan(30)
    // the query reads the same triangle the eye does, so this is float rounding
    expect(worst).toBeLessThan(0.01)
  })
})

describe('the road out', () => {
  it('leaves town at ground level and stays walkable into the open', async () => {
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

      let walkable = 0
      let steps = 0
      for (let out = 4; out <= 800; out += 8) {
        const ox = exit.x === 0 ? -out : exit.x === width - 1 ? width * cell + out : x
        const oz = exit.y === 0 ? -out : exit.y === height - 1 ? height * cell + out : z
        steps++
        if (land.walkableAt(ox, oz)) walkable++
        if (out <= 100) expect(land.heightAt(ox, oz)).toBeLessThan(1)
      }
      expect(walkable / steps).toBeGreaterThan(0.9)
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
      // and you cannot walk on it
      expect(land.walkableAt(centre.x, centre.z)).toBe(false)
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
    expect(land.cost.trees).toBeGreaterThan(500)

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

  it('spread out across the open ground instead of hugging the town', async () => {
    const world = await town()
    const land = landOf(world)
    const middle = middleOf(world)

    let far = 0
    for (const wood of land.trees) {
      for (const spot of instances(wood)) {
        if (Math.hypot(spot.x - middle.x, spot.z - middle.z) > 800) far++
      }
    }
    expect(far / land.cost.trees).toBeGreaterThan(0.4)
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
    expect(wet.fog.density).toBeGreaterThan(dry.fog.density)
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
  it('buys kilometres with a handful of draws', async () => {
    const land = landOf(await town('rain-soaked port'))

    expect(land.cost.draws).toBeLessThanOrEqual(6)
    // the shadow pass redraws the woods and nothing else of the landscape
    expect(land.cost.shadowDraws).toBe(land.trees.length)
    expect(land.cost.shadowDraws).toBeLessThanOrEqual(2)
    expect(land.cost.triangles).toBeLessThan(200000)
    expect(land.cost.trees).toBeLessThanOrEqual(land.theme.trees.max)
    expect(land.root.children.filter((child) => child instanceof THREE.Mesh).length).toBeLessThanOrEqual(6)
  })

  it('drops to a quarter of the geometry when asked for less', async () => {
    const world = await town()
    const full = landOf(world)
    const thin = landOf(world, { detail: 'low' })

    expect(thin.cost.triangles).toBeLessThan(full.cost.triangles * 0.4)
    expect(thin.cost.trees).toBeLessThan(full.cost.trees)
    expect(thin.cost.drops).toBeLessThan(full.cost.drops)
    // and it is still the same world, just fewer pieces of it
    expect(thin.horizon).toBeGreaterThan(4000)
  })
})

describe('the sky', () => {
  it('carries a sun, hangs behind everything and hazes to its own colour', async () => {
    const land = landOf(await town())

    expect(land.sky.renderOrder).toBeLessThan(0)
    expect(land.sun.position.y).toBeGreaterThan(0)
    expect(land.fog.color.getHex()).toBe(land.theme.light.haze)
    expect(land.fog.density).toBeGreaterThan(0)
  })

  it('hangs the stars and the moon in the depth buffer, not over the frame', async () => {
    const land = landOf(await town(), { time: 1 })
    const moon = land.root.getObjectByName('land:moon-disc')!

    expect(paintsOverEverything(land.stars)).toBe(false)
    expect(paintsOverEverything(moon)).toBe(false)
    const overhead: string[] = []
    land.root.traverse((object) => {
      if (object !== land.sky && paintsOverEverything(object)) overhead.push(object.name)
    })
    expect(overhead).toEqual([])

    // the skydome is the one exception and it earns it: it is a background, not
    // a thing at a distance, so it is solid, drawn first and writes no depth
    const dome = (land.sky as THREE.Mesh).material as THREE.Material
    expect(dome.transparent).toBe(false)
    expect(dome.depthWrite).toBe(false)
    expect(land.sky.renderOrder).toBeLessThan(land.stars.renderOrder)
    // and the moon covers the stars behind it
    expect(moon.renderOrder).toBeGreaterThan(land.stars.renderOrder)
  })

  it('gives the moon a face: maria, a limb and a phase, painted from the seed', async () => {
    const world = await town()
    const moon = landOf(world, { time: 1 }).root.getObjectByName('land:moon-disc') as THREE.Sprite
    const map = moon.material.map as THREE.DataTexture
    const side = map.image.width
    const face = map.image.data as Uint8Array

    // clear at the corners, solid in the middle: it is a moon, not a square
    expect(face[3]).toBe(0)
    expect(face[((side / 2) * side + side / 2) * 4 + 3]).toBe(255)

    const lit: number[] = []
    for (let texel = 0; texel < face.length; texel += 4) {
      if (face[texel + 3]! > 250) lit.push(face[texel]!)
    }
    // a white ball is one brightness; a moon runs from a dark mare on the unlit
    // side to bright highland on the lit one
    expect(Math.min(...lit)).toBeLessThan(70)
    expect(Math.max(...lit)).toBeGreaterThan(200)

    // and the same world hangs the same moon, every time
    const again = landOf(world, { time: 1 }).root.getObjectByName('land:moon-disc') as THREE.Sprite
    expect((again.material.map as THREE.DataTexture).image.data).toEqual(face)
  })
})

describe('the sky rides with the camera', () => {
  /** An eye standing on the ground at a point, so the walk is a walk over the real land. */
  function standing(land: Land, x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, land.heightAt(x, z) + 1.7, z)
  }

  /** The eight corners of the dome, in world metres. */
  function domeCorners(land: Land): THREE.Vector3[] {
    land.root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(land.sky)
    const out: THREE.Vector3[] = []
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z))
      }
    }
    return out
  }

  /** Which way a handful of stars and the moon lie, seen from here. */
  function bearings(land: Land, eye: THREE.Vector3): THREE.Vector3[] {
    const position = land.stars.geometry.getAttribute('position')
    const out: THREE.Vector3[] = []
    for (let star = 0; star < position.count; star += 97) {
      out.push(new THREE.Vector3().fromBufferAttribute(position, star).add(land.stars.position).sub(eye).normalize())
    }
    out.push(land.root.getObjectByName('land:moon-disc')!.position.clone().sub(eye).normalize())
    return out
  }

  /** What the haze leaves of a surface this far off, in the thinnest air the theme ever has. */
  function throughHaze(land: Land, metres: number): number {
    return Math.exp(-((land.theme.light.density * metres) ** 2))
  }

  it('keeps the whole dome, the stars and the moon inside the far plane, in town and kilometres out', async () => {
    const world = await town()
    const land = landOf(world, { time: 1 })
    const middle = middleOf(world)
    const moon = land.root.getObjectByName('land:moon-disc')!

    for (const eye of [
      new THREE.Vector3(middle.x, 1.7, middle.z),
      standing(land, middle.x + 3000, middle.z - 1500),
      standing(land, middle.x - land.horizon * 0.9, middle.z),
    ]) {
      land.update(1 / 60, eye)

      // the player is inside the sky, not looking at it from outside
      land.root.updateMatrixWorld(true)
      expect(new THREE.Box3().setFromObject(land.sky).containsPoint(eye)).toBe(true)
      // and every corner of it is in front of the far plane, which is the whole
      // point: a corner of a box stands 1.73 times further out than its faces
      for (const corner of domeCorners(land)) expect(eye.distanceTo(corner)).toBeLessThan(land.cameraFar)

      const stars = land.stars.geometry.getAttribute('position')
      const star = new THREE.Vector3()
      for (let index = 0; index < stars.count; index++) {
        star.fromBufferAttribute(stars, index).add(land.stars.position)
        expect(eye.distanceTo(star)).toBeLessThan(land.cameraFar)
      }
      expect(eye.distanceTo(moon.position)).toBeLessThan(land.cameraFar)
    }
  })

  it('leaves the constellations and the moon exactly where they were when the player walks and climbs', async () => {
    const world = await town()
    const land = landOf(world, { time: 1 })
    const middle = middleOf(world)
    const moon = land.root.getObjectByName('land:moon-disc')!

    const home = new THREE.Vector3(middle.x, 1.7, middle.z)
    land.update(0, home)
    const before = bearings(land, home)
    const moonWas = home.distanceTo(moon.position)

    // a kilometre and a half out and up onto the rising ground
    const away = standing(land, middle.x + 1600, middle.z + 1600)
    expect(away.y).toBeGreaterThan(home.y + 5)
    land.update(0, away)

    const after = bearings(land, away)
    for (let index = 0; index < before.length; index++) {
      expect(before[index]!.angleTo(after[index]!)).toBeLessThan(1e-6)
    }
    // the same distance too, so the moon is the same size in the frame
    expect(away.distanceTo(moon.position)).toBeCloseTo(moonWas, 6)
  })

  it('still shows every hill the haze has not taken', async () => {
    const world = await town()
    const land = landOf(world)
    const middle = middleOf(world)

    // the ring of hills, crest and all, is never cut
    const position = land.terrain.geometry.getAttribute('position')
    const vertex = new THREE.Vector3()
    const crest = new THREE.Vector3()
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index)
      if (vertex.y > crest.y) crest.copy(vertex)
    }
    expect(crest.y).toBeGreaterThan(land.theme.relief.peak * 0.8)
    expect(new THREE.Vector3(middle.x, 0, middle.z).distanceTo(crest)).toBeLessThan(land.cameraFar)

    // and anything the far plane does cut is a hundredth of itself by then,
    // which is less than one step of colour once the haze has been over it
    for (const eye of [
      new THREE.Vector3(middle.x, 1.7, middle.z),
      standing(land, middle.x + land.horizon * 0.9, middle.z),
    ]) {
      for (let index = 0; index < position.count; index++) {
        const away = eye.distanceTo(vertex.fromBufferAttribute(position, index))
        if (away > land.cameraFar) expect(throughHaze(land, away)).toBeLessThanOrEqual(0.01)
      }
    }
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

    const look = (): { sun: number; ambient: number; density: number; haze: number; wet: number } => ({
      sun: land.sun.intensity,
      ambient: land.skyLight.intensity,
      density: land.fog.density,
      haze: land.fog.color.getHex(),
      wet: land.wetness,
    })

    land.setWeather('clear')
    const clear = look()
    land.setWeather('overcast')
    const overcast = look()
    land.setWeather('rain')
    const wet = look()

    // the sun goes out of it and the air thickens, step by step
    expect(clear.sun).toBeGreaterThan(overcast.sun)
    expect(overcast.sun).toBeGreaterThan(wet.sun)
    expect(clear.density).toBeLessThan(overcast.density)
    expect(overcast.density).toBeLessThan(wet.density)
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

/** Put the light where it says it is and read the shadow camera off it, as the renderer does. */
function shadowCamera(land: Land): THREE.OrthographicCamera {
  land.sun.updateMatrixWorld(true)
  land.sun.target.updateMatrixWorld(true)
  land.sun.shadow.updateMatrices(land.sun)
  return land.sun.shadow.camera
}

/** Whether a point in the world falls inside a camera's clip volume. */
function inside(camera: THREE.Camera, point: THREE.Vector3): boolean {
  const clip = point.clone().project(camera)
  return Math.abs(clip.x) <= 1 && Math.abs(clip.y) <= 1 && clip.z >= -1 && clip.z <= 1
}

/** Points evenly over a sphere of this radius around a centre. */
function shell(centre: THREE.Vector3, radius: number, steps = 12): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const theta = (i / (steps - 1)) * Math.PI
      const phi = (j / steps) * Math.PI * 2
      out.push(new THREE.Vector3(
        centre.x + radius * Math.sin(theta) * Math.cos(phi),
        centre.y + radius * Math.cos(theta),
        centre.z + radius * Math.sin(theta) * Math.sin(phi),
      ))
    }
  }
  return out
}

describe('the sun casts a shadow', () => {
  it('on a map fine enough for a person and a door to read', async () => {
    const land = landOf(await town())

    expect(land.sun.castShadow).toBe(true)
    expect(land.sun.shadow.mapSize.width).toBe(land.shadow.spec.mapSize)
    const camera = shadowCamera(land)
    expect(camera.right - camera.left).toBe(land.shadow.spec.radius * 2)
    // a 1.8 m person and a 2.1 m door, in texels of shadow
    expect(1.8 / land.shadow.texel).toBeGreaterThan(12)
    expect(2.1 / land.shadow.texel).toBeGreaterThan(14)
  })

  it('over the near field round the viewer, wherever the viewer is', async () => {
    const land = landOf(await town())
    land.setTime(9)
    const middle = middleOf(await town())
    const reach = land.shadow.spec.radius - 0.5

    for (const viewer of [
      new THREE.Vector3(middle.x, 1.7, middle.z),
      new THREE.Vector3(middle.x + 3000, 120, middle.z - 2400),
      new THREE.Vector3(middle.x - 5200, -40, middle.z + 900),
    ]) {
      land.update(0, viewer)
      const camera = shadowCamera(land)
      for (const point of shell(viewer, reach)) {
        expect(inside(camera, point)).toBe(true)
      }
    }
  })

  it('on a map that moves in whole texels, so the edges cannot crawl', async () => {
    const land = landOf(await town())
    land.setTime(10)
    const middle = middleOf(await town())
    const texel = land.shadow.texel
    const seen: THREE.Vector3[] = []

    // slide the viewer four texels in forty steps: a map that is not quantised
    // slides with every one of them
    for (let step = 0; step < 40; step++) {
      land.update(0, new THREE.Vector3(middle.x + step * texel * 0.1, 1.7, middle.z + step * texel * 0.07))
      const at = shadowCamera(land).position.clone()
      if (!seen.length || at.distanceTo(seen[seen.length - 1]!) > 1e-9) seen.push(at)
    }

    expect(seen.length).toBeLessThan(12)
    for (let i = 1; i < seen.length; i++) {
      const moved = seen[i]!.distanceTo(seen[i - 1]!)
      // one texel, or two or three of the map's axes ticking together
      expect(moved).toBeGreaterThanOrEqual(texel * 0.999)
      expect(moved).toBeLessThanOrEqual(texel * Math.sqrt(3) * 1.001)
    }
  })

  it('without turning the sun: the light is a direction, the map is a place', async () => {
    const land = landOf(await town())
    land.setTime(14)
    const heading = (): THREE.Vector3 =>
      land.sun.position.clone().sub(land.sun.target.position).normalize()
    const home = heading()

    for (const viewer of [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4000, 300, -2000)]) {
      land.update(0, viewer)
      expect(heading().distanceTo(home)).toBeLessThan(1e-6)
    }
  })

  it('that dissolves as the sun reaches the horizon, and is gone before the sun is', async () => {
    const land = landOf(await town())
    const strength = (hours: number): number => {
      land.setTime(hours)
      return land.sun.shadow.intensity
    }

    expect(strength(12)).toBe(1)
    let last = 1
    for (const hour of [15, 16, 17, 17.4, 17.7, 18]) {
      const now = strength(hour)
      expect(now).toBeLessThanOrEqual(last)
      last = now
    }
    // gone at the horizon, while the sun itself is still lighting the place
    expect(strength(18)).toBe(0)
    expect(land.sun.intensity).toBeGreaterThan(0)
    expect(strength(0)).toBe(0)
  })

  it('and the moon casts none: a hard shadow at 0.3 lux is a smudge, not a shadow', async () => {
    const land = landOf(await town(), { time: 0 })

    expect(land.moon.castShadow).toBe(false)
    expect(land.moon.intensity).toBeGreaterThan(0)
    // the sun is out of the frame, so a sleeping town pays for no shadow map at all
    expect(land.sun.visible).toBe(false)
  })

  it('from the woods but not from the ground, which shadows itself into stripes', async () => {
    const land = landOf(await town())

    for (const wood of land.trees) {
      expect(wood.castShadow).toBe(true)
      expect(wood.receiveShadow).toBe(true)
    }
    expect(land.terrain.castShadow).toBe(false)
    expect(land.terrain.receiveShadow).toBe(true)
    expect(land.water?.castShadow ?? false).toBe(false)
    expect(land.sky.castShadow).toBe(false)
  })

  it('and lets a box hand it one merged stand-in instead of four meshes', async () => {
    const land = landOf(await town())
    const proxy = new THREE.Object3D()
    proxy.layers.set(SHADOW_LAYER)

    expect(shadowCamera(land).layers.test(proxy.layers)).toBe(true)
    expect(new THREE.PerspectiveCamera().layers.test(proxy.layers)).toBe(false)
  })
})

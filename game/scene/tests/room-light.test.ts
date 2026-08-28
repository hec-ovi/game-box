import type { LightEmitter } from '@gb/scene'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BOUNCE, buildInterior, Greybox, ROOM_LIGHTS, ROOM_SHADOWS } from '../src/index.ts'
import { bar } from './bar.ts'
import { bigTown, town } from './town.ts'

/**
 * What a room is lit by: its own fixtures, where they are drawn, under a
 * budget, falling off the way a real lamp does, with the nearest few casting.
 *
 * The renderer is not run here. Every number below is read off the lights the
 * room actually stood up, and the illuminance is computed with three's own
 * punctual falloff, written out here rather than taken from the box, so a test
 * cannot pass by agreeing with the arithmetic it is checking.
 */

/** three's own punctual falloff: inverse square, windowed to nothing at the light's distance. */
function luxAt(lights: readonly THREE.PointLight[], point: THREE.Vector3, normal: THREE.Vector3): number {
  let lux = 0
  for (const light of lights) {
    if (!light.visible || light.intensity <= 0) continue
    const away = light.position.clone().sub(point)
    const distance = away.length()
    if (distance < 1e-4 || distance >= light.distance) continue
    const cosine = away.dot(normal) / distance
    if (cosine <= 0) continue
    const window = Math.max(0, 1 - (distance / light.distance) ** 4)
    const shade = light.color.getHex() === 0xffffff ? 1 : luminanceOf(light.color)
    lux += (light.intensity * shade * cosine * window * window) / Math.max(distance * distance, 0.01)
  }
  return lux
}

function luminanceOf(colour: THREE.Color): number {
  return 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b
}

const UP = new THREE.Vector3(0, 1, 0)

/** The six ways a cube shadow looks, and the up each face is drawn with. */
const CUBE: Array<[THREE.Vector3, THREE.Vector3]> = [
  [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)],
  [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)],
  [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)],
  [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
  [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)],
  [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)],
]

/** How many draws one caster adds: the meshes inside each of its six 90 degree faces, added up. */
function facesOf(light: THREE.PointLight, meshes: readonly THREE.Mesh[]): number {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.5, light.distance)
  const frustum = new THREE.Frustum()
  let drawn = 0
  for (const [towards, up] of CUBE) {
    camera.position.copy(light.position)
    camera.up.copy(up)
    camera.lookAt(light.position.clone().add(towards))
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    for (const mesh of meshes) if (frustum.intersectsObject(mesh)) drawn++
  }
  return drawn
}

/** A room with the fixtures a dressing would publish: a line of cove over one wall. */
function coveAlong(count: number, candela = 8): LightEmitter[] {
  return Array.from({ length: count }, (_, at) => ({
    kind: 'cove',
    position: [0.4 + (at * 7.2) / Math.max(1, count - 1), 2.35, 0.2] as const,
    colour: 0xffffff,
    intensity: candela,
    radius: 12,
  }))
}

describe('what a room is lit by', () => {
  it('lights a room the art says nothing about, so no room is ever black', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    const lit = built.lights.lights.filter((light) => light.visible)

    // one lamp over each of the interior's rooms, hung under the ceiling
    expect(built.lights.fixtures).toHaveLength(interior.rooms.length)
    expect(lit).toHaveLength(interior.rooms.length)
    for (const light of lit) {
      expect(light.position.y).toBeGreaterThan(2)
      expect(light.position.y).toBeLessThan(4)
      expect(light.decay).toBe(2)
      expect(light.distance).toBeGreaterThan(0)
    }
    // and it lands the room where a room lit by its own fixtures lands: a
    // median 1.9 on the floor, so swapping the art in changes the shape of the
    // light and not its level
    const floor: number[] = []
    for (let x = 0.5; x < interior.size.w; x += 0.5) for (let z = 0.5; z < interior.size.h; z += 0.5) floor.push(luxAt(lit, new THREE.Vector3(x, 0, z), UP))
    floor.sort((one, two) => one - two)
    const median = floor[Math.floor(floor.length / 2)]!
    expect(median).toBeGreaterThan(1.5)
    expect(median).toBeLessThan(2.5)
  })

  it('stands on the fixtures the art drew instead, where the art drew them', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    const fixtures = coveAlong(4)
    built.lights.lit(fixtures)

    expect(built.lights.fixtures.map((one) => one.kind)).toEqual(['cove', 'cove', 'cove', 'cove'])
    const lit = built.lights.lights.filter((light) => light.visible)
    expect(lit).toHaveLength(4)
    for (const fixture of fixtures) {
      const at = lit.find((light) => light.position.x === fixture.position[0])
      expect(at, `a light in the fixture at ${fixture.position[0]}`).toBeDefined()
      expect(at!.position.y).toBe(fixture.position[1])
      expect(at!.position.z).toBe(fixture.position[2])
      expect(at!.intensity).toBe(fixture.intensity)
      expect(at!.distance).toBe(fixture.radius)
    }
  })

  it('falls off, so the far corner of a room is darker than the floor under a fixture', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    built.lights.lit(coveAlong(4))
    const lit = built.lights.lights.filter((light) => light.visible)

    const under = luxAt(lit, new THREE.Vector3(4, 0, 0.6), UP)
    const away = luxAt(lit, new THREE.Vector3(4, 0, 7.4), UP)
    expect(under).toBeGreaterThan(0)
    // a flat fill gave both of these the same number; inverse square over the
    // seven metres between them is what a room's form is made of
    expect(under / away).toBeGreaterThan(6)
  })

  it('makes only the budget of them real lights, and gives those to the nearest', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    // more fixtures than the budget, spread down one wall
    const many = Array.from({ length: ROOM_LIGHTS * 2 }, (_, at) => ({
      kind: 'cove',
      position: [0.2 + at * 0.2, 2.35, 0.2] as const,
      colour: 0xffffff,
      intensity: 8,
      radius: 12,
    }))
    built.lights.lit(many)

    expect(built.lights.fixtures).toHaveLength(many.length)
    expect(built.lights.lights).toHaveLength(ROOM_LIGHTS)
    built.lights.follow(0.3, 0.3)
    const near = built.lights.lights.filter((light) => light.visible)
    expect(near).toHaveLength(ROOM_LIGHTS)
    const furthest = Math.max(...near.map((light) => Math.hypot(light.position.x - 0.3, light.position.z - 0.3)))

    // walked to the other end and the budget went with the player
    built.lights.follow(many.at(-1)!.position[0], 0.3)
    const far = built.lights.lights.filter((light) => light.visible)
    expect(far).toHaveLength(ROOM_LIGHTS)
    expect(Math.min(...far.map((light) => light.position.x))).toBeGreaterThan(furthest)
  })

  it('casts from the nearest few only, at the size and bias the room was measured for', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    const casting = built.lights.lights.filter((light) => light.castShadow)

    expect(casting).toHaveLength(ROOM_SHADOWS.casters)
    // the first slots, which are the ones a room hands its nearest fixtures to
    expect(built.lights.lights.slice(0, ROOM_SHADOWS.casters).every((light) => light.castShadow)).toBe(true)
    for (const light of casting) {
      expect(light.shadow.mapSize.width).toBe(ROOM_SHADOWS.mapSize)
      expect(light.shadow.mapSize.height).toBe(ROOM_SHADOWS.mapSize)
      expect(light.shadow.normalBias).toBe(ROOM_SHADOWS.normalBias)
    }
  })

  it('bounces what the room really throws, and no more', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    const bounce = built.root.getObjectByName('bounce') as THREE.HemisphereLight
    expect(bounce.isHemisphereLight).toBe(true)

    built.lights.lit(coveAlong(4, 8))
    const dim = bounce.intensity
    built.lights.lit(coveAlong(4, 24))
    const bright = bounce.intensity

    expect(dim).toBeGreaterThan(0)
    // three times the candela in the room is three times the bounce off it
    expect(bright / dim).toBeCloseTo(3, 5)
    // and it is a bounce, not a fill: a fraction of what the fixtures lay on the floor
    const lit = built.lights.lights.filter((light) => light.visible)
    const floor = luxAt(lit, new THREE.Vector3(4, 0, 4), UP)
    expect(bright).toBeLessThan(BOUNCE * 2 * floor)
    expect(bright).toBeLessThan(floor)
  })

  it('costs about one more pass over the room per caster, which is what two of them were budgeted at', () => {
    const worlds = [town(), bigTown()]
    let dearest = 0
    let rooms = 0

    for (const world of worlds) for (const interior of world.interiors()) {
      const built = buildInterior(world, interior, new Greybox())
      built.root.updateMatrixWorld(true)
      const meshes: THREE.Mesh[] = []
      const casting: THREE.Mesh[] = []
      built.root.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        meshes.push(mesh)
        if (mesh.castShadow) casting.push(mesh)
      })
      // a shadow pass draws what casts, and only what stands in the face it is
      // drawing, so this is the draws one caster really adds
      for (const light of built.lights.lights.filter((one) => one.castShadow && one.visible)) {
        dearest = Math.max(dearest, facesOf(light, casting) / meshes.length)
      }
      rooms++
      built.dispose()
    }

    expect(rooms).toBeGreaterThan(5)
    // measured over these towns' rooms, 22 to 42 meshes apiece: a caster costs
    // 2.1 times the room's meshes in draws, not six times, because a face draws
    // only what casts and only what stands in its own 90 degrees. So the pair is
    // 90 to 180 depth-only draws a frame over a room that costs 34 to draw
    expect(dearest).toBeLessThan(2.5)
  }, 120_000)

  it('lets go of every light and its shadow when the room is let go', () => {
    const { world, interior } = bar([])
    const built = buildInterior(world, interior, new Greybox())
    const disposed: string[] = []
    for (const light of built.lights.lights) light.addEventListener('dispose', () => disposed.push(light.name))

    built.dispose()
    expect(disposed).toHaveLength(ROOM_LIGHTS)
    expect(built.lights.group.children).toHaveLength(0)
  })
})

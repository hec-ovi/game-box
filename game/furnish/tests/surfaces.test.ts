import { existsSync } from 'node:fs'
import { METRICS } from '@gb/world'
import sharp from 'sharp'
import * as THREE from 'three'
import type { NodeMaterial } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import {
  FURNISH_STYLES,
  FurnishDressing,
  FurnishLibrary,
  SURFACE_LOOKS,
  SURFACE_PARTS,
  SURFACE_TEXTURE_IDS,
  SURFACE_TEXTURES,
  SurfaceLibrary,
  lookOf,
  mapsOf,
  tilingOf,
  type SurfacePart,
} from '../src/index.ts'
import { SOURCE_IMAGES } from '../tools/pack.ts'
import { ROOM_SIZE } from './support.ts'

/**
 * A pack's worth of surfaces without the pack. What is in the images makes no
 * difference to how big they are laid, which is what these tests measure.
 */
const maps = SURFACE_TEXTURE_IDS.map((id) => [id, { map: new THREE.Texture(), normal: new THREE.Texture() }] as const)
const surfaced = new FurnishLibrary('surfaces', new SurfaceLibrary(new Map(maps)))

function dressing(): FurnishDressing {
  return new FurnishDressing(surfaced)
}

/** One texel's brightness, as the mean of its three channels. */
function texelAt(texture: THREE.DataTexture, row: number, column: number): number {
  const data = texture.image.data as Uint16Array
  const at = (row * texture.image.width + column) * 4
  return [0, 1, 2].reduce((sum, channel) => sum + THREE.DataUtils.fromHalfFloat(data[at + channel]!), 0) / 3
}

/**
 * What a matte surface facing straight up or straight down is lit by: the
 * cosine-weighted mean of its hemisphere, scaled so a picture that is 1
 * everywhere lights it by 1. Written here on its own so it holds the probe's
 * bookkeeping to an independent sum.
 */
function irradiance(texture: THREE.DataTexture, facing: 'up' | 'down'): number {
  const { width, height } = texture.image
  let lit = 0
  let sphere = 0
  for (let row = 0; row < height; row++) {
    const elevation = ((row + 0.5) / height - 0.5) * Math.PI
    const cosine = Math.max(0, Math.sin(elevation) * (facing === 'up' ? 1 : -1))
    for (let column = 0; column < width; column++) {
      lit += texelAt(texture, row, column) * cosine * Math.cos(elevation)
      sphere += Math.cos(elevation)
    }
  }
  return (lit / sphere) * 4
}

/**
 * What one of these pictures holds, band by band: the cosine-weighted average
 * over the whole sphere (which is what it lifts a room by), the same over each
 * half, and the brightest texel and how high up it is.
 */
function readProbe(texture: THREE.DataTexture) {
  const data = texture.image.data as Uint16Array
  const { width, height } = texture.image
  let whole = 0
  let solid = 0
  let above = 0
  let below = 0
  let brightest = { value: 0, elevation: -90 }

  for (let row = 0; row < height; row++) {
    const elevation = ((row + 0.5) / height - 0.5) * 180
    const weight = Math.cos((elevation * Math.PI) / 180)
    for (let column = 0; column < width; column++) {
      const at = (row * width + column) * 4
      const value = Math.max(...[0, 1, 2].map((channel) => THREE.DataUtils.fromHalfFloat(data[at + channel]!)))
      whole += value * weight
      solid += weight
      if (elevation > 0) above += value * weight
      else below += value * weight
      if (value > brightest.value) brightest = { value, elevation }
    }
  }
  return { average: whole / solid, above: above / solid, below: below / solid, brightest }
}

/** A wall the way @gb/scene builds one: a box, standing on the floor, somewhere in the room. */
function wall(part: SurfacePart, length: number, height: number, turned: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, METRICS.building.wallThickness),
    dressing().surface(part, ROOM_SIZE),
  )
  mesh.rotation.y = turned
  mesh.position.set(7, height / 2, -3)
  return mesh
}

/** A floor or a ceiling: a plane over the whole room. */
function slab(part: SurfacePart, width: number, depth: number, height: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), dressing().surface(part, ROOM_SIZE))
  mesh.rotation.x = part === 'ceiling' ? Math.PI / 2 : -Math.PI / 2
  mesh.position.set(-4, height, 11)
  return mesh
}

/**
 * How many tiles of the image cover the face of a mesh that looks a given way,
 * along each of the face's own axes. This is what the shader lays down, read
 * off the geometry the renderer would draw.
 */
function tilesAcross(mesh: THREE.Mesh, facing: THREE.Vector3): THREE.Vector2 {
  const tiling = tilingOf(mesh.material as THREE.Material)
  if (!tiling) throw new Error('the surface was not built to tile in metres')

  mesh.updateMatrixWorld(true)
  const normals = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  const covered = new THREE.Box2()

  for (let vertex = 0; vertex < position.count; vertex++) {
    const face = new THREE.Vector3().fromBufferAttribute(normal, vertex).applyMatrix3(normals).normalize()
    if (face.dot(facing) < 0.99) continue
    const point = new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld)
    covered.expandByPoint(tiling.uv(point, face))
  }
  return covered.getSize(new THREE.Vector2())
}

describe('interior surfaces', () => {
  it('puts the same size stones on a small wall and a huge one, and stretches neither', () => {
    const density = tilingOf(dressing().surface('wall', ROOM_SIZE))!.perMetre

    // a cupboard-sized wall and the long side of a hall, one running east, one running north
    for (const [length, height, turned] of [
      [2, METRICS.building.groundFloorHeight, 0],
      [14, METRICS.building.storeyHeight, Math.PI / 2],
    ] as const) {
      const facing = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), turned)
      const tiles = tilesAcross(wall('wall', length, height, turned), facing)

      expect(tiles.x / length, `${length} m of wall`).toBeCloseTo(density, 6)
      // the same density up the wall as along it: any difference is the pattern stretched
      expect(tiles.y / height, `${height} m up that wall`).toBeCloseTo(density, 6)
    }
  })

  it('lays the floor and the ceiling by the same rule, whatever shape the room is', () => {
    for (const part of ['floor', 'ceiling'] as const) {
      const density = tilingOf(dressing().surface(part, ROOM_SIZE))!.perMetre

      for (const [width, depth] of [[3, 3], [16, 5]] as const) {
        const facing = new THREE.Vector3(0, part === 'ceiling' ? -1 : 1, 0)
        const tiles = tilesAcross(slab(part, width, depth, part === 'ceiling' ? 4 : 0), facing)

        expect(tiles.x / width, `${part} ${width} m across`).toBeCloseTo(density, 6)
        expect(tiles.y / depth, `${part} ${depth} m deep`).toBeCloseTo(density, 6)
      }
    }
  })

  it('tiles at the real-world size the table gives for the image on it', () => {
    for (const part of SURFACE_PARTS) {
      for (const style of FURNISH_STYLES) {
        const metres = SURFACE_TEXTURES[lookOf(style, part).map].metres
        expect(tilingOf(new FurnishDressing(surfaced, undefined, style).surface(part, ROOM_SIZE))?.metres, part).toBe(metres)
      }
    }
  })

  it('lays its coordinates where the renderer reads them, and lets a tile repeat', () => {
    for (const part of SURFACE_PARTS) {
      const material = dressing().surface(part, ROOM_SIZE) as NodeMaterial & THREE.MeshStandardMaterial

      // the game draws with WebGPURenderer: a uv it cannot see is a texture blown up to the wall
      expect(material.isNodeMaterial, part).toBe(true)
      expect(material.contextNode, part).toBeTruthy()
      expect(material.colorNode, part).toBeTruthy()
      expect(mapsOf(material)?.map.wrapS, part).toBe(THREE.RepeatWrapping)
      expect(mapsOf(material)?.map.wrapT, part).toBe(THREE.RepeatWrapping)
    }
  })
})

/**
 * What a polished floor gives back.
 *
 * Indoors there is nothing to reflect: `scene.environment` after dark is the
 * prefiltered night sky and the strips in the room are emissive geometry no
 * probe has seen, so a glossy floor came out a hole. The answer is one small
 * picture per language painted from what is really in the room. It has to be
 * bright where the room's light is and dim everywhere else, because an
 * environment lights a room as well as reflecting in it, and one that is
 * bright all over floods it.
 */
describe("a room's own probe", () => {
  it('is one picture per language, and the two are not the same room', () => {
    const library = surfaced.surfaces!
    const corpo = library.probe('corpo')
    const home = library.probe('home')

    expect(corpo).not.toBe(home)
    expect(library.probe('corpo')).toBe(corpo)
    // corpo's strips are cool white and home's coves are warm red
    const cool = readProbe(corpo)
    const warm = readProbe(home)
    expect(cool.average).toBeGreaterThan(0)
    expect(warm.average).toBeGreaterThan(0)
    expect(Array.from(corpo.image.data as Uint16Array)).not.toEqual(Array.from(home.image.data as Uint16Array))
  })

  it('puts its light above the horizon, which is the only half a floor reflects', () => {
    for (const style of FURNISH_STYLES) {
      const read = readProbe(surfaced.surfaces!.probe(style))
      expect(read.brightest.elevation, style).toBeGreaterThan(0)
      expect(read.above, style).toBeGreaterThan(4 * read.below)
    }
  })

  it('is something to reflect and not a light: it barely lifts the room it is in', () => {
    for (const style of FURNISH_STYLES) {
      const read = readProbe(surfaced.surfaces!.probe(style))
      // the brightest band still reads as light on a floor at a grazing angle
      expect(read.brightest.value, style).toBeGreaterThan(0.5)
      // and the whole picture averages near nothing, so the room stays dark
      expect(read.average, style).toBeLessThan(0.15)
    }
  })

  it('paints the lit floor where a ceiling looks, so a downward face samples the floor and not black', () => {
    for (const style of FURNISH_STYLES) {
      const probe = surfaced.surfaces!.probe(style)
      const { width, height } = probe.image
      // the floor's colour is the average of the pool the language draws from
      const pool = SURFACE_LOOKS[style].floor
      const floor =
        pool.reduce((sum, look) => {
          const colour = new THREE.Color().setHex(look.colour, THREE.SRGBColorSpace)
          return sum + (colour.r + colour.g + colour.b) / 3
        }, 0) / pool.length

      // straight down is the floor, lit by what the picture lays on an upward face
      const down = Array.from({ length: width }, (_, column) => texelAt(probe, 0, column)).reduce((a, b) => a + b) / width
      expect(down, `${style} straight down`).toBeCloseTo(floor * irradiance(probe, 'up'), 3)
      expect(down, `${style} straight down`).toBeGreaterThan(0.004)
      // and it is a bounce off a dark surface, a tenth of the light, not a second light
      expect(irradiance(probe, 'down') / irradiance(probe, 'up'), `${style} ceiling against floor`).toBeGreaterThan(0.1)
      expect(irradiance(probe, 'down') / irradiance(probe, 'up'), `${style} ceiling against floor`).toBeLessThan(0.5)
      expect(height).toBe(32)
    }
  })

  it('is on every surface, so no floor, wall or ceiling is a hole', () => {
    for (const style of FURNISH_STYLES) {
      for (const part of SURFACE_PARTS) {
        const material = new FurnishDressing(surfaced, undefined, style).surface(part, ROOM_SIZE) as NodeMaterial
        expect(material.envNode, `${style} ${part}`).toBeTruthy()
      }
    }
  })
})

/**
 * The images the pack is built from, against the numbers the box holds about
 * them.
 *
 * Both of these are cheap to get wrong by hand and neither shows up as an
 * error: a grain figure that does not match its image paints every room in that
 * surface at the wrong brightness while the probe, which is painted from the
 * colour the look names, goes on assuming the right one; and an image no look
 * reaches is bytes inside every copy of every world file for nothing.
 */
describe('the images behind the surfaces', () => {
  it('divides each image by its own average, so a surface comes out the colour it names', async () => {
    for (const id of SURFACE_TEXTURE_IDS) {
      // the Downtown source is fetched, not committed, so a fresh clone has
      // only the generated ones to hold against the table
      if (!existsSync(SOURCE_IMAGES[id])) continue
      expect(SURFACE_TEXTURES[id].grain, id).toBeCloseTo(await averageOf(SOURCE_IMAGES[id]), 2)
    }
  })

  it('reaches every image it packs', () => {
    const used = new Set(
      FURNISH_STYLES.flatMap((style) => SURFACE_PARTS.flatMap((part) => SURFACE_LOOKS[style][part].map((l) => l.map))),
    )
    expect([...SURFACE_TEXTURE_IDS].sort()).toEqual([...used].sort())
  })
})

/** An image's average brightness in linear light, the way the sampler sees it. */
async function averageOf(file: string): Promise<number> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let total = 0
  for (let at = 0; at < data.length; at += info.channels) {
    for (let channel = 0; channel < 3; channel++) {
      const value = data[at + channel]! / 255
      total += (value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)) / 3
    }
  }
  return total / (data.length / info.channels)
}

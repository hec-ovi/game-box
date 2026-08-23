import { METRICS } from '@gb/world'
import * as THREE from 'three'
import type { NodeMaterial } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import {
  FurnishDressing,
  FurnishLibrary,
  SURFACE_LOOKS,
  SURFACE_PARTS,
  SURFACE_TEXTURE_IDS,
  SURFACE_TEXTURES,
  SurfaceLibrary,
  tilingOf,
  type SurfacePart,
} from '../src/index.ts'

/**
 * A pack's worth of surfaces without the pack. What is in the images makes no
 * difference to how big they are laid, which is what these tests measure.
 */
function dressing(): FurnishDressing {
  const maps = SURFACE_TEXTURE_IDS.map((id) => [id, { map: new THREE.Texture(), normal: new THREE.Texture() }] as const)
  return new FurnishDressing(new FurnishLibrary(new Map(), new Map(), new SurfaceLibrary(new Map(maps))))
}

/** A wall the way @gb/scene builds one: a box, standing on the floor, somewhere in the room. */
function wall(part: SurfacePart, length: number, height: number, turned: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, METRICS.building.wallThickness),
    dressing().surface(part),
  )
  mesh.rotation.y = turned
  mesh.position.set(7, height / 2, -3)
  return mesh
}

/** A floor or a ceiling: a plane over the whole room. */
function slab(part: SurfacePart, width: number, depth: number, height: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), dressing().surface(part))
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
    const density = tilingOf(dressing().surface('wall'))!.perMetre

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
      const density = tilingOf(dressing().surface(part))!.perMetre

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
      const metres = SURFACE_TEXTURES[SURFACE_LOOKS[part].map].metres
      expect(tilingOf(dressing().surface(part))?.metres, part).toBe(metres)
    }
  })

  it('lays its coordinates where the renderer reads them, and lets a tile repeat', () => {
    for (const part of SURFACE_PARTS) {
      const material = dressing().surface(part) as NodeMaterial & THREE.MeshStandardMaterial

      // the game draws with WebGPURenderer: a uv it cannot see is a texture blown up to the wall
      expect(material.isNodeMaterial, part).toBe(true)
      expect(material.contextNode, part).toBeTruthy()
      expect(material.map?.wrapS, part).toBe(THREE.RepeatWrapping)
      expect(material.map?.wrapT, part).toBe(THREE.RepeatWrapping)
    }
  })
})

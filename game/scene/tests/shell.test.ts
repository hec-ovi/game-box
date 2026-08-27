import type { Furniture } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildInterior, CEILING_HEIGHT, Greybox, type SurfacePart, type SurfaceSize } from '../src/index.ts'
import { bar } from './bar.ts'

/** The bar's shell, built for real, with whatever the test wants standing in it. */
function room(dressing = new Greybox(), furniture: Furniture[] = []) {
  const { world, interior } = bar(furniture)
  return { interior, built: buildInterior(world, interior, dressing) }
}

/** A greybox that writes down what it was asked for. */
class Asked extends Greybox {
  readonly sizes: Array<{ part: SurfacePart; size: SurfaceSize }> = []
  override surface(part: SurfacePart, size?: SurfaceSize): THREE.Material {
    if (size) this.sizes.push({ part, size })
    return super.surface(part)
  }
}

describe('the shell of a room', () => {
  it('lays every surface out in metres, so a texture tiles at real size and runs on round the corner', () => {
    const { built } = room()
    const meshes = built.root.children.filter((child) => (child as THREE.Mesh).isMesh) as THREE.Mesh[]
    const shell = meshes.filter((mesh) => mesh.geometry instanceof THREE.PlaneGeometry || mesh.geometry instanceof THREE.BoxGeometry)
    expect(shell.length).toBeGreaterThan(4)

    for (const mesh of shell) {
      mesh.updateMatrix()
      const position = mesh.geometry.getAttribute('position')
      const normal = mesh.geometry.getAttribute('normal')
      const uv = mesh.geometry.getAttribute('uv')
      const turn = new THREE.Matrix3().getNormalMatrix(mesh.matrix)
      for (let at = 0; at < position.count; at++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, at).applyMatrix4(mesh.matrix)
        const facing = new THREE.Vector3().fromBufferAttribute(normal, at).applyMatrix3(turn)
        if (Math.abs(facing.y) > 0.99) {
          // a floor or a ceiling is laid out on the ground
          expect(uv.getX(at)).toBeCloseTo(point.x, 5)
          expect(uv.getY(at)).toBeCloseTo(point.z, 5)
        } else {
          // a wall runs along itself and climbs
          expect(uv.getY(at)).toBeCloseTo(point.y, 5)
          expect(uv.getX(at)).toBeCloseTo(Math.abs(facing.x) > 0.99 ? point.z : point.x, 5)
        }
      }
    }
  })

  it('tells the dressing how many metres each surface covers', () => {
    const asked = new Asked()
    const { interior } = room(asked)
    const { w, h } = interior.size

    expect(asked.sizes).toContainEqual({ part: 'floor', size: { u: w, v: h } })
    expect(asked.sizes).toContainEqual({ part: 'ceiling', size: { u: w, v: h } })
    const walls = asked.sizes.filter((one) => one.part === 'wall')
    expect(walls.length).toBeGreaterThan(3)
    // the bar's street door is on the north wall, so that wall is asked for in two pieces and the rest whole
    expect(walls.filter((one) => one.size.u === w)).toHaveLength(3)
    expect(walls.every((one) => one.size.v === CEILING_HEIGHT && one.size.u > 0 && one.size.u <= w)).toBe(true)
  })
})

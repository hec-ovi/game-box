import { existsSync } from 'node:fs'
import { buildInterior } from '@gb/scene'
import { FURNITURE_PROPS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FurnishDressing, isWorldTiled, PROP_ART, SURFACE_LOOKS, SURFACE_TEXTURES } from '../src/index.ts'
import { KIT_FILE, loadPackedFurnish } from './pack.ts'
import { backwardsMass, boundsOf, busiest, meshesOf, sizeOf, town, trianglesOf } from './support.ts'

// the pack arrives with tools/build-kit.ts; without it there is nothing to check
const packed = existsSync(KIT_FILE)
const kit = packed ? await loadPackedFurnish() : undefined
const dressing = kit ? new FurnishDressing(kit) : undefined

describe.skipIf(!packed)('the shipped pack', () => {
  it('gives every prop real art, painted with the kit texture', () => {
    for (const prop of FURNITURE_PROPS) {
      const object = dressing!.prop(prop)
      expect(trianglesOf(object), prop).toBeGreaterThan(0)

      for (const mesh of meshesOf(object)) {
        const material = mesh.material as THREE.MeshStandardMaterial
        expect(material.map, `${prop} on ${material.name}`).toBeInstanceOf(THREE.Texture)
      }
    }
  })

  it('builds it at the size the room planner kept clear, standing on the floor', () => {
    for (const prop of FURNITURE_PROPS) {
      const art = PROP_ART[prop]
      const object = dressing!.prop(prop)
      const bounds = boundsOf(object)
      const size = bounds.getSize(new THREE.Vector3())

      expect(size.x, `${prop} across`).toBeCloseTo(art.w, 2)
      expect(size.z, `${prop} deep`).toBeCloseTo(art.d, 2)
      if (art.h !== undefined) expect(size.y, `${prop} tall`).toBeCloseTo(art.h, 2)
      expect(bounds.min.y, `${prop} sits on the floor`).toBeCloseTo(0, 2)
      expect(Math.abs(bounds.getCenter(new THREE.Vector3()).x), `${prop} centred`).toBeLessThan(0.01)
    }
  })

  it('turns everything with a back to it so its front looks north', () => {
    // a chair, a sofa and a bed carry their upper half behind them: the backrest, the headboard
    for (const prop of ['chair', 'office-chair', 'sofa', 'bed'] as const) {
      expect(backwardsMass(dressing!.prop(prop)), prop).toBeGreaterThan(0.02)
    }
  })

  it('loads the art once: two chairs are two objects over one buffer', () => {
    const first = dressing!.prop('chair') as THREE.Mesh
    const second = dressing!.prop('chair') as THREE.Mesh

    expect(second).not.toBe(first)
    expect(second.geometry).toBe(first.geometry)
    expect(second.material).toBe(first.material)
  })

  it('carries a floor and walls that tile at real-world size', () => {
    for (const part of ['floor', 'wall', 'ceiling'] as const) {
      const material = dressing!.surface(part) as THREE.MeshStandardMaterial
      const tile = SURFACE_TEXTURES[SURFACE_LOOKS[part].map].tile

      expect(material.map, part).toBeInstanceOf(THREE.Texture)
      expect(material.normalMap, part).toBeInstanceOf(THREE.Texture)
      // colour is authored in sRGB and relief is not: swapped slots wash a surface out
      expect(material.map!.colorSpace, part).toBe(THREE.SRGBColorSpace)
      expect(material.normalMap!.colorSpace, part).toBe(THREE.NoColorSpace)
      expect(material.map!.repeat.x, `${part} tiles every ${tile} m`).toBeCloseTo(1 / tile, 4)
      // the UVs @gb/scene puts on a floor plane run 0..1 across the room, so the material lays its own
      expect(isWorldTiled(material), part).toBe(true)
    }

    // the wall and the ceiling are the same plaster: one image, one upload
    const wall = dressing!.surface('wall') as THREE.MeshStandardMaterial
    const ceiling = dressing!.surface('ceiling') as THREE.MeshStandardMaterial
    expect(ceiling.map).toBe(wall.map)
    expect(ceiling).not.toBe(wall)
  })

  it('patches the shader three actually ships, not one it used to', () => {
    const shader = { vertexShader: THREE.ShaderLib['standard']!.vertexShader }
    dressing!.surface('floor').onBeforeCompile(shader as never, null as never)

    // the anchor is a chunk name; a three upgrade that renames it would leave the shader untouched
    expect(shader.vertexShader).toContain('gbPlanar')
    expect(shader.vertexShader).toContain('vMapUv = ( mapTransform * vec3( gbPlanar, 1 ) ).xy;')
  })

  it('furnishes a room for one draw per piece and shares every buffer in it', async () => {
    const world = await town()
    const interior = busiest(world)
    const room = buildInterior(world, interior, dressing!)

    const furniture = [...room.props.values()]
    expect(furniture.length).toBe(interior.furniture.length)

    const meshes = furniture.flatMap((object) => meshesOf(object))
    const kinds = new Set(interior.furniture.map((piece) => piece.prop))
    // a prop is one mesh, and the same prop twice in a room is the same buffer twice
    expect(meshes.length).toBe(furniture.length)
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(kinds.size)
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBeLessThanOrEqual(2)

    // and nothing is standing in the floor or floating over it
    for (const object of furniture) expect(boundsOf(object).min.y).toBeCloseTo(0, 2)
    expect(sizeOf(room.root).y).toBeLessThan(5)
  })
})

import { Forge, OfflineNarrator } from '@gb/forge'
import { Greybox, storeyHeight } from '@gb/scene'
import type { Plot, ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PrefabDressing, type BuildingSize } from '../src/dressing.ts'
import { MATERIAL_NAME, SHELL_MATERIAL_NAME } from '../src/pack.ts'
import { readPack } from '../tools/headless.ts'

const library = await readPack()
const dressing = new PrefabDressing(library, new Greybox())

const built = await new Forge(new OfflineNarrator('shells')).build({ theme: 'a neon port city', seed: 'shells', blocksX: 2, blocksY: 2, density: 1, maxStoreys: 4 })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world

/** Every plot of the forged town, with what the dressing is handed for it. */
const town: Array<{ plot: Plot; size: BuildingSize; charter: ResolvedCharter }> = [...world.plots()].map((plot) => ({
  plot,
  size: { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) },
  charter: world.charter(plot.kind)!,
}))

/** The one mesh on that material, which is what a building and its shell are each drawn as. */
function on(object: THREE.Object3D, material: string): THREE.Mesh {
  const found: THREE.Mesh[] = []
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && (mesh.material as THREE.Material).name === material) found.push(mesh)
  })
  expect(found, material).toHaveLength(1)
  return found[0]!
}

describe('the shell of a forged town', () => {
  it('stands where the building stands, so the town keeps its shape as you walk up to it', () => {
    expect(town.length).toBeGreaterThan(40)
    for (const { plot, size, charter } of town) {
      const walls = on(dressing.building(plot, size, charter), MATERIAL_NAME).geometry
      const shell = on(dressing.shell(plot, size, charter), SHELL_MATERIAL_NAME).geometry
      walls.computeBoundingBox()
      shell.computeBoundingBox()

      // the same box: the same model, turned the same way onto the same plot
      for (const end of ['min', 'max'] as const) {
        for (const axis of ['x', 'y', 'z'] as const) {
          expect(shell.boundingBox![end][axis], `${plot.id} ${end}.${axis}`).toBeCloseTo(walls.boundingBox![end][axis], 6)
        }
      }
      // and the same pictures on the same faces, so it reads as the same building
      expect(shell.getAttribute('_layer').array, plot.id).toEqual(walls.getAttribute('_layer').array)
    }
  })

  it('is one indexed mesh on one material, so the whole far town is one draw', () => {
    for (const { plot, size, charter } of town) {
      const meshes: THREE.Mesh[] = []
      dressing.shell(plot, size, charter).traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh)
      })

      expect(meshes.map((mesh) => (mesh.material as THREE.Material).name), plot.id).toEqual([SHELL_MATERIAL_NAME])
      expect(meshes[0]!.geometry.getIndex(), plot.id).not.toBeNull()
    }
  })
})

import { World, type Plot } from '@gb/world'
import * as THREE from 'three'

export const CELL = 2

/** A plot on its own, so a test can say exactly what shape of building it wants. */
export function plotOf(spec: Partial<Plot> & Pick<Plot, 'kind' | 'rect' | 'entrance'>): Plot {
  const world = World.create({ name: 'kitbash', theme: 'test', seed: 'kitbash', width: 40, height: 40 })
  const added = world.addPlot({
    kind: spec.kind,
    name: spec.name ?? 'A place',
    rect: spec.rect,
    entrance: spec.entrance,
    storeys: spec.storeys ?? 2,
    style: spec.style ?? 'plain',
  })
  if (!added.ok) throw new Error(JSON.stringify(added.error))
  return added.value
}

export function sizeOf(plot: Plot, height: number): { width: number; depth: number; height: number } {
  return { width: plot.rect.w * CELL, depth: plot.rect.h * CELL, height }
}

export function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object)
}

export function meshesOf(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = []
  object.traverse((child) => { if (child instanceof THREE.Mesh) found.push(child) })
  return found
}

export function trianglesOf(object: THREE.Object3D): number {
  return meshesOf(object).reduce((total, mesh) => total + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0)
}

/**
 * Every vertex attribute of every mesh, mixed into one number: two buildings
 * match or they do not. Rooms ride on the panes as attributes, so this catches
 * a window that would light up differently as well as one in the wrong place.
 */
export function fingerprint(object: THREE.Object3D): string {
  let hash = 0x811c9dc5
  const fold = (value: number): void => { hash = Math.imul(hash ^ value, 0x01000193) }
  const foldText = (text: string): void => { for (const character of text) fold(character.charCodeAt(0)) }

  for (const mesh of meshesOf(object).sort((a, b) => a.name.localeCompare(b.name))) {
    foldText(mesh.name)
    for (const name of Object.keys(mesh.geometry.attributes).sort()) {
      foldText(name)
      const values = mesh.geometry.getAttribute(name).array as ArrayLike<number>
      for (let i = 0; i < values.length; i++) fold(Math.round(values[i]! * 1000))
    }
  }
  return (hash >>> 0).toString(16)
}

import { Rng } from '@gb/kit'
import { BUILDING_KINDS, World, type Plot } from '@gb/world'
import * as THREE from 'three'
import { SIGN } from '../src/index.ts'

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

/** The building without its signage: the walls the plot boundary is a promise about. */
export function wallBounds(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3()
  for (const mesh of meshesOf(object)) {
    if ((mesh.material as THREE.Material).name === SIGN.material) continue
    box.union(new THREE.Box3().setFromObject(mesh))
  }
  return box
}

/** Just the signs, when a test is about them and not about the walls. */
export function signMesh(object: THREE.Object3D): THREE.Mesh | undefined {
  return meshesOf(object).find((mesh) => (mesh.material as THREE.Material).name === SIGN.material)
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

/**
 * A town of plots of every kind, every height and every facing, cut from a
 * seed: what a generated city hands the dressing, without the generator.
 */
export function townOf(seed: string, count: number): Plot[] {
  const world = World.create({ name: 'town', theme: 'test', seed, width: TOWN, height: TOWN })
  const rng = new Rng(seed)
  const plots: Plot[] = []
  let [x, y] = [2, 2]
  for (let at = 0; at < count; at++) {
    const [w, h] = [rng.int(1, 6), rng.int(2, 5)]
    if (x + w + 2 > TOWN - 2) [x, y] = [2, y + 8]
    const facing = FACINGS[at % FACINGS.length]!
    const cell = facing === 'south' ? { x, y: y + h } : facing === 'north' ? { x, y: y - 1 } : facing === 'east' ? { x: x + w, y } : { x: x - 1, y }
    const added = world.addPlot({ kind: BUILDING_KINDS[at % BUILDING_KINDS.length]!, name: `Place ${at} Of The Town`, rect: { x, y, w, h }, entrance: { cell, facing }, storeys: 1 + (at % 6), style: 'plain' })
    if (!added.ok) throw new Error(JSON.stringify(added.error))
    plots.push(added.value)
    x += w + 2
  }
  return plots
}

const FACINGS = ['north', 'south', 'east', 'west'] as const

/** Cells across the town: room for a hundred and more plots in rows. */
const TOWN = 200

import * as THREE from 'three'
import { CityNight } from '@gb/kitbash'
import type { Plot } from '@gb/world'
import { Catalogue, type CatalogueDoc } from '../src/catalogue.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { Library } from '../src/library.ts'
import type { PrefabAtlas } from '../src/material.ts'
import { LAYER_ATTRIBUTE } from '../src/pack.ts'

/**
 * What the fixture pack paints, in the order the strips stack it. The door
 * plate the test buildings carry is layer 1, and the entrance you can walk
 * through is last, exactly as the shipped pack stacks them.
 */
export const FINISHES: readonly string[] = ['wall:facade-a', DOOR_FINISH, 'glass', OPEN_DOOR_FINISH]

/** A catalogue with two looks on one shape, so a pick has something to choose between. */
export function catalogueOf(over: Partial<CatalogueDoc> = {}): Catalogue {
  return Catalogue.parse({
    pack: 'test',
    version: '1.0.0',
    sha256: 'a'.repeat(64),
    producer: 'test',
    atlas: {
      colour: { size: 4, layers: FINISHES.length, sha256: 'b'.repeat(64) },
      emissive: { size: 4, layers: FINISHES.length, sha256: 'c'.repeat(64) },
      rooms: { size: 4, layers: 2, sha256: 'd'.repeat(64) },
      screens: { size: 4, layers: 2, sha256: 'e'.repeat(64) },
      finishes: [...FINISHES],
    },
    models: [
      { id: 'shop-8x12x2', look: 'shop', front: 8, depth: 12, storeys: 2, kinds: ['shop', 'cafe'], triangles: 12, door: { along: 0 } },
      { id: 'home-8x12x2', look: 'home', front: 8, depth: 12, storeys: 2, kinds: ['house'], triangles: 12, door: { along: 0 } },
      { id: 'works-8x12x2', look: 'works', front: 8, depth: 12, storeys: 2, kinds: ['workshop', 'shop'], triangles: 12, door: { along: 0 } },
    ],
    ...over,
  })
}

/**
 * A library of boxes at the sizes the catalogue names, so the dressing can be
 * tested without the shipped pack: a door plate on the south wall marks which
 * way the model is facing.
 */
export function libraryOf(catalogue: Catalogue): Library {
  const scene = new THREE.Group()
  for (const model of catalogue.models) {
    const height = 4 + (model.storeys - 1) * 3.2
    const shell = box(model.front, height, model.depth, 0, height / 2, 0, 0)
    const door = box(1, 2.1, 0.1, 0, 1.05, model.depth / 2, 1)
    const mesh = new THREE.Mesh(merge([shell, door]), new THREE.MeshBasicMaterial())
    mesh.name = model.id
    scene.add(mesh)
  }
  return Library.of({ catalogue, scenes: scene, atlas: atlasOf(), night: new CityNight() })
}

export function atlasOf(): PrefabAtlas {
  const layers = FINISHES.length
  const pixels = () => new THREE.DataArrayTexture(new Uint8Array(4 * 4 * layers * 4).fill(128), 4, 4, layers)
  return { colour: pixels(), emissive: pixels(), rooms: pixels(), screens: pixels(), finishes: [...FINISHES] }
}

export function plotOf(over: Partial<Plot> = {}): Plot {
  return {
    id: 'plot_0001',
    kind: 'shop',
    name: 'Test',
    rect: { x: 4, y: 4, w: 4, h: 6 },
    entrance: { cell: { x: 6, y: 3 }, facing: 'north' },
    storeys: 2,
    style: 'neon-shop',
    ...over,
  } as Plot
}

function box(width: number, height: number, depth: number, x: number, y: number, z: number, layer: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth).translate(x, y, z).toNonIndexed()
  const count = geometry.getAttribute('position').count
  geometry.setAttribute(LAYER_ATTRIBUTE, new THREE.Float32BufferAttribute(new Float32Array(count).fill(layer), 1))
  return indexed(geometry)
}

function indexed(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geometry.getAttribute('position').count
  geometry.setIndex(Array.from({ length: count }, (_, i) => i))
  return geometry
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv', LAYER_ATTRIBUTE]) {
    const size = parts[0]!.getAttribute(name).itemSize
    const values: number[] = []
    for (const part of parts) values.push(...Array.from(part.getAttribute(name).array as Float32Array))
    out.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(values), size))
  }
  const index: number[] = []
  let at = 0
  for (const part of parts) {
    for (const value of Array.from(part.getIndex()!.array)) index.push(value + at)
    at += part.getAttribute('position').count
  }
  out.setIndex(index)
  return out
}

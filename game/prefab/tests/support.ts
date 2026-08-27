import * as THREE from 'three'
import { CityNight } from '@gb/kitbash'
import { SHIPPED_CHARTERS, type Plot, type ResolvedCharter } from '@gb/world'
import { Catalogue, type CatalogueDoc } from '../src/catalogue.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { Library } from '../src/library.ts'
import type { PrefabAtlas } from '../src/material.ts'
import { LAYER_ATTRIBUTE } from '../src/pack.ts'
import { DISPLAY_FINISH } from '../src/screens.ts'

/**
 * What the fixture pack paints, in the order the strips stack it. The door
 * plate the test buildings carry is layer 1, the entrance you can walk through
 * is last, exactly as the shipped pack stacks them, and the screen plate the
 * shop carries is after it.
 */
export const FINISHES: readonly string[] = ['wall:facade-a', DOOR_FINISH, 'glass', OPEN_DOOR_FINISH, DISPLAY_FINISH]

/** The screen plate the fixture shop carries beside its door, in metres. */
export const PLATE = { wide: 1.2, tall: 2.4, deep: 0.1, x: -2.5, y: 1.4 } as const

/**
 * The smallest glazing strip a city can be drawn from: one back wall and one
 * flat panel, both banks reading the same layer, and the four shared faces.
 */
export const GLAZING = {
  rooms: { upper: { first: 0, count: 1 }, street: { first: 0, count: 1 } },
  panels: { upper: { first: 1, count: 1 }, street: { first: 1, count: 1 } },
  faces: { floor: 2, ceiling: 3, side: 4, sideAlt: 5 },
} as const
export const GLAZING_LAYERS = 6

/** What the fixture pack's strips say they hold. */
export function atlasDocOf(over: Partial<CatalogueDoc['atlas']> = {}): CatalogueDoc['atlas'] {
  return {
    colour: { size: 4, layers: FINISHES.length, sha256: 'b'.repeat(64) },
    emissive: { size: 4, layers: FINISHES.length, sha256: 'c'.repeat(64) },
    rooms: { size: 4, layers: GLAZING_LAYERS, sha256: 'd'.repeat(64), ...GLAZING },
    screens: { size: 4, layers: 2, sha256: 'e'.repeat(64) },
    finishes: [...FINISHES],
    ...over,
  }
}

/** A catalogue with two looks on one shape, so a pick has something to choose between. */
export function catalogueOf(over: Partial<CatalogueDoc> = {}): Catalogue {
  return Catalogue.parse({
    pack: 'test',
    version: '1.0.0',
    sha256: 'a'.repeat(64),
    producer: 'test',
    atlas: atlasDocOf(),
    models: [
      { id: 'shop-8x12x2', look: 'shop', front: 8, depth: 12, storeys: 2, tags: ['shop', 'cafe'], triangles: 12, door: { along: 0 } },
      { id: 'home-8x12x2', look: 'home', front: 8, depth: 12, storeys: 2, tags: ['house'], triangles: 12, door: { along: 0 } },
      { id: 'works-8x12x2', look: 'works', front: 8, depth: 12, storeys: 2, tags: ['workshop', 'shop'], triangles: 12, door: { along: 0 } },
    ],
    ...over,
  })
}

/**
 * A library of boxes at the sizes the catalogue names, so the dressing can be
 * tested without the shipped pack: a door plate on the south wall marks which
 * way the model is facing, and the shop carries a screen plate beside it.
 */
export function libraryOf(catalogue: Catalogue): Library {
  const scene = new THREE.Group()
  for (const model of catalogue.models) {
    const height = 4 + (model.storeys - 1) * 3.2
    const shell = box(model.front, height, model.depth, 0, height / 2, 0, 0)
    const door = box(1, 2.1, 0.1, 0, 1.05, model.depth / 2, 1)
    const parts = [shell, door]
    if (model.look === 'shop') parts.push(box(PLATE.wide, PLATE.tall, PLATE.deep, PLATE.x, PLATE.y, model.depth / 2, FINISHES.indexOf(DISPLAY_FINISH)))
    const mesh = new THREE.Mesh(merge(parts), new THREE.MeshBasicMaterial())
    mesh.name = model.id
    scene.add(mesh)
  }
  return Library.of({ catalogue, scenes: scene, atlas: atlasOf(), night: new CityNight() })
}

export function atlasOf(): PrefabAtlas {
  const pixels = (layers: number) => new THREE.DataArrayTexture(new Uint8Array(4 * 4 * layers * 4).fill(128), 4, 4, layers)
  return {
    colour: pixels(FINISHES.length),
    emissive: pixels(FINISHES.length),
    rooms: pixels(GLAZING_LAYERS),
    glazing: GLAZING,
    screens: pixels(2),
    finishes: [...FINISHES],
  }
}

/** The preset charter the plot's word names, which is what `@gb/scene` resolves and hands the dressing beside the plot. */
export function charterOf(plot: Plot): ResolvedCharter {
  const charter = SHIPPED_CHARTERS.find((preset) => preset.word === plot.kind)
  if (!charter) throw new Error(`${plot.kind} is not a preset`)
  return charter
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

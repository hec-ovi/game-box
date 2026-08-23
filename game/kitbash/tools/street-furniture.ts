/**
 * Writes the street furniture into a small glTF the pack builder merges in.
 * The Downtown kit is a building kit and has no lamp in it, so the lamp comes
 * from Quaternius' Modular Street Pack (CC0, already in the registry), which
 * only ships OBJ.
 *
 * Called by tools/build-kit.ts.
 * Reads:  assets/src/quaternius-street/... (GB_STREET_PACK overrides)
 */
import { resolve } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { FURNITURE_IDS, LAMP_LENS, LAMP_POST, type FurnitureId } from '../src/catalog/furniture.ts'
import { readObj, type ObjRun } from './obj.ts'

/** Where the street pack lands when tools/fetch-assets.mjs unpacks it. Override with GB_STREET_PACK. */
export const STREET_DIRECTORY = process.env['GB_STREET_PACK'] ?? resolve(
  import.meta.dirname,
  '../../../assets/src/quaternius-street/extracted/OBJ',
)

/** The pack is modelled about a metre tall; a street lamp stands four and a half. */
const LAMP_SCALE = 4

/** Which OBJ each piece comes from, and what its own material names become here. */
const SOURCES: Record<FurnitureId, { file: string; scale: number; materials: Record<string, string> }> = {
  Streetlight_Single: {
    file: 'Streetlight_Single.obj',
    scale: LAMP_SCALE,
    // the housing and the bulb are one lens: they light together and they never
    // want a draw each
    materials: { Green: LAMP_POST, Glass: LAMP_LENS, Light: LAMP_LENS },
  },
}

/** Flat colours, straight off the pack's own .mtl files. */
const COLOURS: Record<string, [number, number, number, number]> = {
  [LAMP_POST]: [0.013, 0.044, 0.017, 1],
  [LAMP_LENS]: [0.64, 0.44, 0.016, 1],
}

export async function writeStreetFurniture(file: string): Promise<void> {
  const document = new Document()
  const buffer = document.createBuffer()
  const scene = document.createScene('street')
  const materials = new Map<string, ReturnType<Document['createMaterial']>>()

  for (const id of FURNITURE_IDS) {
    const source = SOURCES[id]
    const mesh = document.createMesh(id)

    for (const run of merged(id)) {
      const name = source.materials[run.material] ?? run.material
      let material = materials.get(name)
      if (!material) {
        material = document.createMaterial(name)
          .setBaseColorFactor(COLOURS[name] ?? [0.5, 0.5, 0.5, 1])
          .setRoughnessFactor(name === LAMP_LENS ? 0.25 : 0.55)
          .setMetallicFactor(0)
        materials.set(name, material)
      }
      mesh.addPrimitive(document.createPrimitive()
        .setAttribute('POSITION', document.createAccessor().setType('VEC3').setBuffer(buffer).setArray(run.position))
        .setAttribute('NORMAL', document.createAccessor().setType('VEC3').setBuffer(buffer).setArray(run.normal))
        .setIndices(document.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(run.index))
        .setMaterial(material))
    }
    scene.addChild(document.createNode(id).setMesh(mesh))
  }

  await new NodeIO().write(file, document)
}

/**
 * One piece's runs, with everything that ends up on the same material welded
 * together, so a lamp is two primitives rather than one per source material.
 */
function merged(id: FurnitureId): ObjRun[] {
  const source = SOURCES[id]
  const runs = readObj(resolve(STREET_DIRECTORY, source.file), source.scale)
  const byMaterial = new Map<string, { position: number[]; normal: number[]; index: number[] }>()

  for (const run of runs) {
    const name = source.materials[run.material] ?? run.material
    let out = byMaterial.get(name)
    if (!out) {
      out = { position: [], normal: [], index: [] }
      byMaterial.set(name, out)
    }
    const offset = out.position.length / 3
    out.position.push(...run.position)
    out.normal.push(...run.normal)
    for (const at of run.index) out.index.push(at + offset)
  }

  return [...byMaterial].map(([material, out]) => ({
    material,
    position: Float32Array.from(out.position),
    normal: Float32Array.from(out.normal),
    index: Uint32Array.from(out.index),
  }))
}

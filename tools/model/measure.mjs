/**
 * What a model costs, and the budget it is measured against.
 *
 * Triangles are the obvious number and rarely the one that hurts. Draws are:
 * every primitive is a draw call, and a car whose door, handle, mirror and
 * badge each carry their own material is several draws rather than one, on
 * every car on the road. Textures are third: a 4K sheet on something seen from
 * ten metres is memory spent on nothing.
 */
import { statSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

/**
 * What a street car can afford, taken from the pack that ships. A hero the
 * player drives may spend more; a street holds tens of cars at once, so the
 * number that matters is the per-car one.
 */
export const BUDGET = { triangles: 12000, draws: 4, texture: 1024 }

/** Our own pack ships meshopt-compressed, and so do plenty of downloads. */
export function reader() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
}

/** Triangles, draws, materials and textures of a document already in memory. */
export function measure(document) {
  const root = document.getRoot()

  let triangles = 0
  let draws = 0
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      draws++
      triangles += triangleCount(primitive)
    }
  }

  const widest = root.listTextures().reduce((most, texture) => {
    const size = texture.getSize()
    return Math.max(most, size?.[0] ?? 0, size?.[1] ?? 0)
  }, 0)

  return {
    triangles,
    draws,
    materials: root.listMaterials().length,
    meshes: root.listMeshes().length,
    nodes: root.listNodes().length,
    textures: root.listTextures().length,
    widest,
    skinned: root.listSkins().length > 0,
    animations: root.listAnimations().length,
  }
}

export function triangleCount(primitive) {
  const indices = primitive.getIndices()
  const position = primitive.getAttribute('POSITION')
  return Math.floor((indices ? indices.getCount() : (position?.getCount() ?? 0)) / 3)
}

/** The same, read off a file, with what it weighs on disk. */
export async function measureFile(file, io = reader()) {
  return { ...measure(await io.read(file)), bytes: statSync(file).size }
}

/** The reasons a model would cost more than it is worth. */
export function against(one, budget = BUDGET) {
  const said = []
  if (one.triangles > budget.triangles) {
    said.push(`${one.triangles.toLocaleString()} triangles, over ${budget.triangles.toLocaleString()}`)
  }
  if (one.draws > budget.draws) said.push(`${one.draws} draws a car`)
  if (one.widest > budget.texture) said.push(`a ${one.widest} px texture`)
  return said
}

/** One line of numbers, for a before and after that line up. */
export function line(label, one) {
  const mb = one.bytes === undefined ? '' : `  ${(one.bytes / 1048576).toFixed(2)} MB`
  return (
    `${label.padEnd(8)} ${String(one.triangles).padStart(8)} tris  ${String(one.draws).padStart(4)} draws  ` +
    `${String(one.materials).padStart(3)} mats  ${String(one.textures).padStart(3)} tex  ` +
    `${String(one.widest || '-').padStart(5)} px${mb}`
  )
}

import { Document, Logger, type TypedArray } from '@gltf-transform/core'
import { dedup, meshopt, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { MATERIAL_NAME } from '../src/pack.ts'
import { io } from './intake.ts'
import type { Baked } from './intake.ts'

/**
 * The pack's mesh file: one mesh per model, all of them on the one material the
 * whole city is drawn with.
 *
 * Welded, quantized and meshopt-packed, the same treatment `tools/build-kit.ts`
 * gives the Downtown kit, which takes 500-odd buildings from 12 MB to 3. What
 * quantization costs is half a millimetre on a vertex; the builder measures
 * every model again after the fact and refuses a pack that drifted further.
 */
export async function writePack(models: readonly Baked[]): Promise<Uint8Array> {
  await MeshoptEncoder.ready
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.ERROR))
  doc.createBuffer()
  const scene = doc.createScene('prefab')
  const material = doc.createMaterial(MATERIAL_NAME)

  for (const model of models) {
    const primitive = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(model.position as TypedArray))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(model.normal as TypedArray))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(model.uv as TypedArray))
      .setAttribute('_LAYER', doc.createAccessor().setType('SCALAR').setArray(model.layer as TypedArray))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(narrow(model.index) as TypedArray))

    const mesh = doc.createMesh(model.id).addPrimitive(primitive)
    scene.addChild(doc.createNode(model.id).setMesh(mesh))
  }

  await doc.transform(weld(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  return await io.writeBinary(doc)
}

/** A model has a few hundred vertices, so its indices fit in half the bytes. */
function narrow(index: Uint32Array): Uint32Array | Uint16Array {
  let highest = 0
  for (const value of index) highest = Math.max(highest, value)
  return highest < 65535 ? Uint16Array.from(index) : index
}

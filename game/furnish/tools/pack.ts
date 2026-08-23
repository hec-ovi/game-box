/**
 * Assembles the raw interior pack: every source model under a node named the
 * way the loader looks for it, plus the tiling surfaces a room is built out of.
 *
 * The models are merged here rather than by `gltf-transform merge` because the
 * loader finds a piece by node name and the packs name their nodes after their
 * own files ("kitchenBar(Clone)"). Reading them without registering
 * KHR_materials_unlit also drops it, which is what we want: an unlit material
 * takes no light from the sky and casts no shadow.
 *
 * Called by tools/build-kit.ts.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Document, NodeIO, TextureInfo, type Material, type Scene } from '@gltf-transform/core'
import { KHRTextureTransform } from '@gltf-transform/extensions'
import { mergeDocuments } from '@gltf-transform/functions'
import { PIECE_IDS } from '../src/catalog/pieces.ts'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS, type SurfaceTextureId } from '../src/surfaces/surfaces.ts'
import { fileOf } from './measure.ts'

export const TEXTURE_DIRECTORY =
  process.env['GB_DOWNTOWN_TEXTURES'] ??
  join(resolve(import.meta.dirname, '../../..'), 'assets/src/quaternius-downtown/extracted/Textures')

/** Which of the kit's textures each interior surface is made of. */
const SOURCES: Record<SurfaceTextureId, { colour: string; normal: string }> = {
  // the kit's stone slabs: four to a tile, which is a half-metre flagged floor
  flagstone: { colour: 'T_MarbleFloor_BaseColor', normal: 'T_MarbleFloor_Normal' },
  // and its concrete, which tinted warm is an interior plaster wall
  plaster: { colour: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal' },
}

const REPEAT = TextureInfo.WrapMode['REPEAT']!

/** Furniture is lit, not painted: the sky and the lamps decide how it reads. */
const ROUGHNESS = 0.75

export async function writePack(file: string): Promise<void> {
  // the atlas packs place their swatches with a texture transform, so that one
  // is kept; KHR_materials_unlit is deliberately not, see above
  const io = new NodeIO().registerExtensions([KHRTextureTransform])
  const document = new Document()
  document.createBuffer()
  const scene = document.createScene('interior')

  addSurfaces(document, scene)
  for (const id of PIECE_IDS) await addPiece(io, document, scene, id)
  for (const material of document.getRoot().listMaterials()) lit(material)
  oneBuffer(document)

  await io.write(file, document)
}

/**
 * One source model, under one node named after the catalog id. Its own scene
 * graph is kept: a piece is several primitives and a couple of transforms, and
 * flattening it here would only make the pack builder guess at them.
 */
async function addPiece(io: NodeIO, document: Document, scene: Scene, id: string): Promise<void> {
  const source = await io.read(fileOf(id as never))
  const before = new Set(document.getRoot().listScenes())
  mergeDocuments(document, source)

  const holder = document.createNode(id)
  for (const merged of document.getRoot().listScenes()) {
    if (before.has(merged)) continue
    for (const child of merged.listChildren()) holder.addChild(child)
    merged.dispose()
  }
  scene.addChild(holder)
}

/**
 * The tiling interior surfaces: one node per surface, a quad carrying nothing
 * but the material its maps hang on. The game never draws the quad, it only
 * reads the maps off it.
 *
 * The textures are the Downtown kit's, the same ones the street outside is made
 * of, because the furniture packs are palettes of flat swatches with no pattern
 * in them: nothing in them tiles.
 */
function addSurfaces(document: Document, scene: Scene): void {
  const buffer = document.getRoot().listBuffers()[0]!
  const position = document.createAccessor('position').setType('VEC3').setBuffer(buffer)
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]))
  const uv = document.createAccessor('uv').setType('VEC2').setBuffer(buffer)
    .setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
  const indices = document.createAccessor('indices').setType('SCALAR').setBuffer(buffer)
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))

  for (const id of SURFACE_TEXTURE_IDS) {
    const source = SOURCES[id]
    const material = document.createMaterial(`MI_${SURFACE_TEXTURES[id].node}`)

    material.setBaseColorTexture(texture(document, `surface_${id}_colour`, source.colour))
    repeating(material.getBaseColorTextureInfo())
    material.setNormalTexture(texture(document, `surface_${id}_relief`, source.normal))
    repeating(material.getNormalTextureInfo())

    const primitive = document.createPrimitive()
      .setAttribute('POSITION', position)
      .setAttribute('TEXCOORD_0', uv)
      .setIndices(indices)
      .setMaterial(material)
    scene.addChild(
      document.createNode(SURFACE_TEXTURES[id].node).setMesh(document.createMesh(id).addPrimitive(primitive)),
    )
  }
}

/** A .glb holds one buffer, and every merged model arrived with its own. */
function oneBuffer(document: Document): void {
  const [keep, ...rest] = document.getRoot().listBuffers()
  if (!keep) return
  for (const accessor of document.getRoot().listAccessors()) accessor.setBuffer(keep)
  for (const buffer of rest) buffer.dispose()
}

/**
 * glTF defaults a material to fully metallic, which under the sky the app sets
 * as an environment turns a wooden chair into a mirror. Nothing indoors here is
 * metal, and nothing is glazed either: one blended draw for an oven door costs
 * sorting for a pane the eye reads as dark grey anyway.
 */
function lit(material: Material): void {
  const [red, green, blue] = material.getBaseColorFactor()
  material
    .setMetallicFactor(0)
    .setRoughnessFactor(ROUGHNESS)
    .setAlphaMode('OPAQUE')
    .setBaseColorFactor([red!, green!, blue!, 1])
}

function texture(document: Document, name: string, file: string) {
  return document.createTexture(name).setMimeType('image/png').setImage(readFileSync(join(TEXTURE_DIRECTORY, `${file}.png`)))
}

/** An interior surface tiles, so the sampler in the pack has to say so too. */
function repeating(info: TextureInfo | null): void {
  info?.setWrapS(REPEAT).setWrapT(REPEAT)
}

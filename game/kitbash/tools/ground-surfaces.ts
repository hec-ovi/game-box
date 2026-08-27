/**
 * Writes the tiling ground surfaces into a small glTF the pack builder merges
 * in: one node per surface, a quad carrying nothing but the material its maps
 * hang on. The game never draws the quad, it only reads the maps off it.
 *
 * Colour and relief are the kit's own, so the two the buildings already use
 * cost nothing: the pack's dedup step folds them into one copy. Wear is not:
 * the kit's own ORM carries a flat 255 of occlusion on the concrete and the
 * marble and a flat 0 on the dirt, so there is nothing in it to hang a hollow
 * on. It is derived from each surface's own colour map by
 * `tools/textures/relief.mjs` and committed under `assets/gen`, which is also
 * why the pavement is a concrete flag rather than the polished marble the kit
 * authored that image as.
 *
 * Called by tools/build-kit.ts.
 * Reads:  the kit's texture folder (GB_DOWNTOWN_KIT overrides) and assets/gen
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Document, NodeIO, TextureInfo } from '@gltf-transform/core'
import { GROUND_TEXTURES, GROUND_TEXTURE_IDS, type GroundTextureId } from '../src/ground/surfaces.ts'
import { KIT_DIRECTORY } from './measure.ts'

/** Where the maps we derived ourselves live. */
const GENERATED = resolve(import.meta.dirname, '../../../assets/gen')

/** Which of the kit's textures each surface is made of, and the wear we derived from it. */
const SOURCES: Record<GroundTextureId, { colour: string; normal: string; wear: string }> = {
  asphalt: { colour: 'T_Concrete_Asphalt_BaseColor', normal: 'T_Concrete_Normal', wear: 'ground-asphalt-orm' },
  // the kit's marble floor: laid four slabs to a tile, tinted grey, it is a pavement
  paving: { colour: 'T_MarbleFloor_BaseColor', normal: 'T_MarbleFloor_Normal', wear: 'ground-paving-orm' },
  earth: { colour: 'T_Dirt_BaseColor', normal: 'T_Dirt_Normal', wear: 'ground-earth-orm' },
}

const REPEAT = TextureInfo.WrapMode['REPEAT']!

export async function writeGroundSurfaces(file: string): Promise<void> {
  const document = new Document()
  const buffer = document.createBuffer()
  const scene = document.createScene('ground')

  // one quad, shared by every surface: it is a place to hang a material, not art
  const position = document.createAccessor('position').setType('VEC3').setBuffer(buffer)
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]))
  const uv = document.createAccessor('uv').setType('VEC2').setBuffer(buffer)
    .setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
  const indices = document.createAccessor('indices').setType('SCALAR').setBuffer(buffer)
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))

  for (const id of GROUND_TEXTURE_IDS) {
    const source = SOURCES[id]
    const material = document.createMaterial(`MI_${GROUND_TEXTURES[id].node}`).setRoughnessFactor(1).setMetallicFactor(0)

    material.setBaseColorTexture(texture(document, source.colour))
    repeating(material.getBaseColorTextureInfo())
    material.setNormalTexture(texture(document, source.normal))
    repeating(material.getNormalTextureInfo())
    // one image in two slots: glTF reads roughness off green and occlusion off
    // red, so a surface pays for one image and the runtime for one sampler
    const wear = texture(document, source.wear, GENERATED)
    material.setMetallicRoughnessTexture(wear)
    repeating(material.getMetallicRoughnessTextureInfo())
    material.setOcclusionTexture(wear)
    repeating(material.getOcclusionTextureInfo())

    const primitive = document.createPrimitive()
      .setAttribute('POSITION', position)
      .setAttribute('TEXCOORD_0', uv)
      .setIndices(indices)
      .setMaterial(material)
    scene.addChild(document.createNode(GROUND_TEXTURES[id].node).setMesh(document.createMesh(id).addPrimitive(primitive)))
  }

  await new NodeIO().write(file, document)
}

function texture(document: Document, name: string, from = KIT_DIRECTORY) {
  return document.createTexture(name).setMimeType('image/png').setImage(readFileSync(join(from, `${name}.png`)))
}

/** Ground tiles, so the sampler in the pack has to say so too. */
function repeating(info: TextureInfo | null): void {
  info?.setWrapS(REPEAT).setWrapT(REPEAT)
}

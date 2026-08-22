/**
 * Writes the tiling ground surfaces into a small glTF the pack builder merges
 * in: one node per surface, a quad carrying nothing but the material its maps
 * hang on. The game never draws the quad, it only reads the maps off it.
 *
 * The textures are the kit's own, so the two the buildings already use cost
 * nothing: the pack's dedup step folds them into one copy.
 *
 * Called by tools/build-kit.ts.
 * Reads:  the kit's texture folder (GB_DOWNTOWN_KIT overrides)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Document, NodeIO, TextureInfo } from '@gltf-transform/core'
import { GROUND_TEXTURES, GROUND_TEXTURE_IDS, type GroundTextureId } from '../src/ground/surfaces.ts'
import { KIT_DIRECTORY } from './measure.ts'

/** Which of the kit's textures each surface is made of. */
const SOURCES: Record<GroundTextureId, { colour: string; normal?: string }> = {
  asphalt: { colour: 'T_Concrete_Asphalt_BaseColor', normal: 'T_Concrete_Normal' },
  // the kit's marble floor: laid four slabs to a tile, tinted grey, it is a pavement
  paving: { colour: 'T_MarbleFloor_BaseColor', normal: 'T_MarbleFloor_Normal' },
  earth: { colour: 'T_Dirt_BaseColor' },
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
    if (source.normal) {
      material.setNormalTexture(texture(document, source.normal))
      repeating(material.getNormalTextureInfo())
    }

    const primitive = document.createPrimitive()
      .setAttribute('POSITION', position)
      .setAttribute('TEXCOORD_0', uv)
      .setIndices(indices)
      .setMaterial(material)
    scene.addChild(document.createNode(GROUND_TEXTURES[id].node).setMesh(document.createMesh(id).addPrimitive(primitive)))
  }

  await new NodeIO().write(file, document)
}

function texture(document: Document, name: string) {
  const image = readFileSync(join(KIT_DIRECTORY, `${name}.png`))
  return document.createTexture(name).setMimeType('image/png').setImage(image)
}

/** Ground tiles, so the sampler in the pack has to say so too. */
function repeating(info: TextureInfo | null): void {
  info?.setWrapS(REPEAT).setWrapT(REPEAT)
}

/**
 * Writes the tiling interior surfaces into a small glTF the pack builder merges
 * in: one node per surface, a quad carrying nothing but the material its maps
 * hang on. The game never draws the quad, it only reads the maps off it.
 *
 * The textures are the Downtown kit's, the same ones the street outside is made
 * of, because the KayKit atlases are palettes of flat swatches with no pattern
 * in them: nothing in either furniture pack tiles.
 *
 * Called by tools/build-kit.ts.
 * Reads: assets/src/quaternius-downtown/extracted/Textures (GB_DOWNTOWN_TEXTURES overrides)
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Document, NodeIO, TextureInfo } from '@gltf-transform/core'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS, type SurfaceTextureId } from '../src/surfaces/surfaces.ts'

export const TEXTURE_DIRECTORY =
  process.env['GB_DOWNTOWN_TEXTURES'] ??
  join(resolve(import.meta.dirname, '../../..'), 'assets/src/quaternius-downtown/extracted/Textures')

/** Which of the kit's textures each surface is made of. */
const SOURCES: Record<SurfaceTextureId, { colour: string; normal: string }> = {
  // the kit's stone slabs: four to a tile, which is a half-metre flagged floor
  flagstone: { colour: 'T_MarbleFloor_BaseColor', normal: 'T_MarbleFloor_Normal' },
  // and its concrete, which tinted warm is an interior plaster wall
  plaster: { colour: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal' },
}

const REPEAT = TextureInfo.WrapMode['REPEAT']!

export async function writeSurfaces(file: string): Promise<void> {
  const document = new Document()
  const buffer = document.createBuffer()
  const scene = document.createScene('surfaces')

  // one quad, shared by every surface: it is a place to hang a material, not art
  const position = document.createAccessor('position').setType('VEC3').setBuffer(buffer)
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]))
  const uv = document.createAccessor('uv').setType('VEC2').setBuffer(buffer)
    .setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
  const indices = document.createAccessor('indices').setType('SCALAR').setBuffer(buffer)
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))

  for (const id of SURFACE_TEXTURE_IDS) {
    const source = SOURCES[id]
    const material = document.createMaterial(`MI_${SURFACE_TEXTURES[id].node}`).setRoughnessFactor(1).setMetallicFactor(0)

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

  await new NodeIO().write(file, document)
}

function texture(document: Document, name: string, file: string) {
  return document.createTexture(name).setMimeType('image/png').setImage(readFileSync(join(TEXTURE_DIRECTORY, `${file}.png`)))
}

/** An interior surface tiles, so the sampler in the pack has to say so too. */
function repeating(info: TextureInfo | null): void {
  info?.setWrapS(REPEAT).setWrapT(REPEAT)
}

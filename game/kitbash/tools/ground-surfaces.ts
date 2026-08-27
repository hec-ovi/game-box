/**
 * Writes the tiling ground surfaces into a small glTF the pack builder merges
 * in: one node per surface, a quad carrying nothing but the material its maps
 * hang on. The game never draws the quad, it only reads the maps off it.
 *
 * The road is the kit's own asphalt, which the buildings already carry, so the
 * pack's dedup step folds it into one copy. The pavement and the earth are
 * generated tiles under `assets/gen`, cut seamless by `tools/textures/tile.mjs`.
 *
 * No surface takes its wear from the kit: the ORM the kit ships with its
 * asphalt has a flat 255 of occlusion in it, so there is nothing to hang a
 * hollow on. Every wear image, and the normal of every generated tile, comes
 * from `tools/textures/relief.mjs` and is committed under `assets/gen`.
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

/** What each surface is painted and shaped by, and where those images come from. */
const SOURCES: Record<GroundTextureId, { from: string; colour: string; normal: string; wear: string }> = {
  // the roadway stays the kit's own asphalt: its albedo is what @gb/scene's wet
  // film and its road paint are aimed at, and the town tones are measured off it
  asphalt: { from: KIT_DIRECTORY, colour: 'T_Concrete_Asphalt_BaseColor', normal: 'T_Concrete_Normal', wear: 'ground-asphalt-orm' },
  paving: { from: GENERATED, colour: 'ground-paving-flags-tile', normal: 'ground-paving-flags-normal', wear: 'ground-paving-flags-orm' },
  earth: { from: GENERATED, colour: 'ground-earth-bare-tile', normal: 'ground-earth-bare-normal', wear: 'ground-earth-bare-orm' },
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

    material.setBaseColorTexture(texture(document, source.colour, source.from))
    repeating(material.getBaseColorTextureInfo())
    material.setNormalTexture(texture(document, source.normal, source.from))
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

function texture(document: Document, name: string, from: string) {
  return document.createTexture(name).setMimeType('image/png').setImage(readFileSync(join(from, `${name}.png`)))
}

/** Ground tiles, so the sampler in the pack has to say so too. */
function repeating(info: TextureInfo | null): void {
  info?.setWrapS(REPEAT).setWrapT(REPEAT)
}

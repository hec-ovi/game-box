/**
 * Assembles the interior pack: the grain images a room is built out of, one per
 * node, under the name the loader looks for.
 *
 * The furniture is not in here. It is generated from parameters at load time,
 * so the only art an interior needs is those images.
 *
 * Called by tools/build-kit.ts.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Document, NodeIO, TextureInfo, type Scene } from '@gltf-transform/core'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS, type SurfaceTextureId } from '../src/surfaces/surfaces.ts'

const ROOT = resolve(import.meta.dirname, '../../..')

export const TEXTURE_DIRECTORY =
  process.env['GB_DOWNTOWN_TEXTURES'] ?? join(ROOT, 'assets/src/quaternius-downtown/extracted/Textures')

/** Textures we generated ourselves, which is why they ship inside a world file. */
const GENERATED = join(ROOT, 'assets/gen')

/**
 * Which image each interior surface is made of, and where that image comes
 * from. Every one is stochastic grain and nothing else: the pattern a floor or
 * a wall is laid in is arithmetic in the shader, so no image here carries
 * structure that would jog where the tile is cut.
 *
 * The three generated ones are colour only. A wall in this box is a run of bays
 * standing 3 to 14 cm off it, so its relief is geometry, and a normal map
 * derived from a colour map would put highlights where the picture has no
 * feature. The Downtown concrete keeps the relief that was authored with it.
 */
const SOURCES: Record<SurfaceTextureId, { colour: string; normal?: string; from?: string }> = {
  // the Downtown kit's street concrete, which is the bare slab a flat is floored in
  plaster: { colour: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal' },
  // ours: see tools/textures/README.md. A moulded panel is smooth, which is the
  // whole point of it
  panel: { colour: 'wall-plastic-home-tile', from: GENERATED },
  // ours: the corpo wall and the lid over it
  formwork: { colour: 'wall-concrete-corpo-tile', from: GENERATED },
  // ours: the corpo floor, which is the biggest surface in view in a room and
  // the one the reflection probe is painted against
  screed: { colour: 'floor-concrete-corpo-tile', from: GENERATED },
}

/** Where each surface's colour image is on disk, for anything that wants to measure it. */
export const SOURCE_IMAGES: Record<SurfaceTextureId, string> = Object.fromEntries(
  SURFACE_TEXTURE_IDS.map((id) => [id, join(SOURCES[id].from ?? TEXTURE_DIRECTORY, `${SOURCES[id].colour}.png`)]),
) as Record<SurfaceTextureId, string>

const REPEAT = TextureInfo.WrapMode['REPEAT']!

export async function writePack(file: string): Promise<void> {
  const document = new Document()
  document.createBuffer()
  addSurfaces(document, document.createScene('interior'))
  await new NodeIO().write(file, document)
}

/**
 * One node per surface, a quad carrying nothing but the material its maps hang
 * on. The game never draws the quad, it only reads the maps off it.
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
    const material = document.createMaterial(`MI_${SURFACE_TEXTURES[id].node}`).setMetallicFactor(0)

    material.setBaseColorTexture(texture(document, `surface_${id}_colour`, source.colour, source.from))
    repeating(material.getBaseColorTextureInfo())
    if (source.normal) {
      material.setNormalTexture(texture(document, `surface_${id}_relief`, source.normal, source.from))
      repeating(material.getNormalTextureInfo())
    }

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

function texture(document: Document, name: string, file: string, from = TEXTURE_DIRECTORY) {
  return document.createTexture(name).setMimeType('image/png').setImage(readFileSync(join(from, `${file}.png`)))
}

/** An interior surface tiles, so the sampler in the pack has to say so too. */
function repeating(info: TextureInfo | null): void {
  info?.setWrapS(REPEAT).setWrapT(REPEAT)
}

/**
 * Builds the dressed people the game loads. For every outfit in
 * game/cast/wardrobe.json this merges the base body with the outfit's parts
 * into one finished character GLB: the body geometry the clothes cover is
 * dropped, every part is repainted and moved onto the body's own skin, and the
 * whole character is quantized against one scene-wide volume so the file
 * carries a single skeleton. Nothing is bound at runtime.
 *
 * The garments arrive fantasy and leave modern. The pack's belts, bracers and
 * pauldrons are separate nodes and are simply not worn; its knee boots are cut
 * off above the shoe and its trousers taken down over them; its green cloth,
 * tan harness and metal studs are repainted city colours, and what was painted
 * on as hardware is settled into the cloth around it. See tools/wardrobe/.
 *
 * Every hairstyle cut for the body goes into the same file, one node each, so
 * the game can show one of them per NPC and hide the rest.
 *
 * It also writes assets/dist/wardrobe.json: the list the game fetches, saying
 * which file to load, who each outfit suits, and which hairstyles it carries.
 *
 * Run: node tools/build-wardrobe.mjs
 */
import { dedup, mergeDocuments, meshopt, prune } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { GarmentPainter } from './wardrobe/painter.mjs'
import { Palette } from './wardrobe/palette.mjs'
import { agree, refit } from './wardrobe/refit.mjs'
import { settleOnSkin } from './wardrobe/settle.mjs'
import { normalizeWeights, trimCovered } from './wardrobe/skin.mjs'
import { SourceReader } from './wardrobe/source.mjs'
import { cutAbove, dropHem } from './wardrobe/tailor.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'assets', 'src')
const DIST = join(ROOT, 'assets', 'dist')
const OUT = join(DIST, 'characters')

/**
 * The bones whose geometry is skin rather than clothes. Everything the base
 * body has below the neck is inside an outfit part, so it is removed: a body
 * left under the clothes pokes through them and costs triangles for nothing.
 */
const BARE = new Set(['neck_01', 'Head'])

/** How far outside the skin a hair, brow or beard vertex is held, in metres. */
const ON_THE_SKIN = 0.003

/**
 * How far outside the skin a garment vertex is held, in metres. The pack's
 * collars are cut for a narrower neck than this body's, so worn as they come a
 * coat's back panel crosses the nape and shows through the skin as a hole with
 * torn edges. A collar sits on the neck rather than in it.
 */
const ON_THE_NECK = 0.01

/** The body's own pieces that sit on the skin rather than being it. */
const ON_THE_FACE = new Set(['Eyes', 'Eyebrows'])

const reader = new SourceReader()
await MeshoptEncoder.ready

const manifest = JSON.parse(readFileSync(join(ROOT, 'game', 'cast', 'wardrobe.json'), 'utf8'))
const palette = new Palette(manifest.fabrics)
const finish = manifest.finish
const parts = join(SRC, manifest.partsDir)
// start clean: an outfit that has been renamed or dropped would otherwise sit
// in the pack forever, and the game loads whatever wardrobe.json names
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const characters = []
for (const outfit of manifest.outfits) {
  const bodyFile = manifest.bodies[outfit.body]
  if (!bodyFile) throw new Error(`outfit ${outfit.id}: no body named ${outfit.body}`)

  const doc = await reader.read(join(SRC, bodyFile))
  const skin = doc.getRoot().listSkins()[0]
  if (!skin) throw new Error(`${bodyFile}: no skin`)
  const kept = trimCovered(doc, skin, BARE)
  // what is left of the body is the skin the hair has to stay outside of;
  // the eyes and the body's own eyebrows are on it, not part of it
  const bare = doc
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh() && !ON_THE_FACE.has(node.getName()))
    .map((node) => node.getMesh())

  const painter = new GarmentPainter(palette, finish)
  let shifted = 0
  let collar = -Infinity
  let lifted = 0
  for (const part of outfit.parts) {
    const source = await reader.read(join(parts, `${part.name}.gltf`))
    // altered before anything else looks at it: the repaint should not spend
    // atlas pixels on a boot shaft that is about to be cut off
    if (part.cut !== undefined) cutAbove(source, part.cut)
    if (part.hem !== undefined) dropHem(source, part.hem)
    await painter.add(source, part)
    const worn = wear(doc, skin, source, part.name, { drop: part.drop, onSkin: bare, clearance: ON_THE_NECK })
    shifted = Math.max(shifted, worn.shifted)
    collar = Math.max(collar, worn.top)
    lifted = Math.max(lifted, worn.settled)
  }
  if (kept > collar) {
    throw new Error(
      `${outfit.id}: bare skin reaches down to y=${kept.toFixed(3)} but the clothes stop at ` +
        `y=${collar.toFixed(3)}, which leaves a gap at the neck`,
    )
  }
  const repainted = await recolour(doc, painter, outfit.id)

  // hair goes on after the collar check: it sits above the neck and would
  // otherwise pass the check for the clothes
  const hair = manifest.hair[outfit.body] ?? { styles: [] }
  const styles = []
  let settled = 0
  for (const style of hair.styles) {
    const worn = wear(doc, skin, await hairPiece(style), style, { name: nodeName('hair', style), onSkin: bare })
    shifted = Math.max(shifted, worn.shifted)
    settled = Math.max(settled, worn.settled)
    styles.push(nodeName('hair', style))
  }
  const beard = hair.beard ? nodeName('beard', hair.beard) : undefined
  if (hair.beard) settled = Math.max(settled, wear(doc, skin, await hairPiece(hair.beard), hair.beard, { name: beard, onSkin: bare }).settled)

  // the body brings one pair of eyebrows; the other pair is a second shape to
  // pick from, so two people with the same hair still have different faces
  const brows = ['brows_base']
  rename(doc, 'Eyebrows', brows[0])
  if (hair.brows) {
    brows.push(nodeName('brows', hair.brows))
    settled = Math.max(settled, wear(doc, skin, await hairPiece(hair.brows), hair.brows, { name: brows[1], onSkin: bare }).settled)
  }

  await tidy(doc)

  const file = `characters/${outfit.id}.glb`
  const evened = await write(doc, join(DIST, file))
  characters.push({
    id: outfit.id,
    body: outfit.body,
    file,
    roles: outfit.roles,
    themes: outfit.themes,
    styles,
    brows,
    ...(beard ? { beard } : {}),
  })
  console.log(
    `${outfit.id}: ${outfit.parts.length} garments (${repainted}), ${styles.length} hairstyles,` +
      ` ${brows.length} brow shapes${beard ? ', a beard' : ''};` +
      ` refitted by up to ${(shifted * 100).toFixed(1)} cm, collars opened over the neck by up to ${(lifted * 1000).toFixed(1)} mm,` +
      ` hair lifted out of the skin by up to ${(settled * 1000).toFixed(1)} mm,` +
      ` ${evened} skin weights evened,` +
      ` bare skin kept down to y=${kept.toFixed(3)} m` +
      ` -> ${(statSync(join(DIST, file)).size / 1e6).toFixed(2)} MB`,
  )
}

writeFileSync(join(DIST, 'wardrobe.json'), `${JSON.stringify({ characters }, null, 2)}\n`)
console.log(`${characters.length} characters + wardrobe.json -> ${DIST}`)

function hairPiece(style) {
  return reader.read(join(SRC, manifest.hair.dir, `${style}.gltf`))
}

/** The highest point of a part, in metres, after everything that moves it has run. */
function highest(part) {
  let top = -Infinity
  for (const mesh of part.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      top = Math.max(top, prim.getAttribute('POSITION').getMax([])[1])
    }
  }
  return top
}

/** `Hair_SimpleParted` -> `hair_simpleparted`. A glTF loader strips `:` and `.` out of node names. */
function nodeName(kind, source) {
  return `${kind}_${source.replace(/^(Hair|Eyebrows)_/, '').toLowerCase()}`
}

/** Renames the one node called `from`, so the game can pick it out of the finished file. */
function rename(doc, from, to) {
  const node = doc.getRoot().listNodes().find((one) => one.getName() === from)
  if (!node) throw new Error(`no node named ${from} to rename to ${to}`)
  node.setName(to)
}

/**
 * Merges one part in, refits it to the body and moves it onto the body's own
 * skin. `name` renames the part's node, which is how the game finds a
 * hairstyle to show or hide at spawn; `drop` names nodes not worn at all,
 * which is where the pack's belts, bracers and buckles go; `onSkin` names the
 * bare skin meshes the part is held `clearance` outside of, which every piece
 * worn over the head and neck needs.
 */
function wear(doc, skin, part, what, { name, drop, onSkin, clearance = ON_THE_SKIN } = {}) {
  const partSkin = part.getRoot().listSkins()[0]
  if (!partSkin) throw new Error(`${what}: no skin`)
  agree(skin, partSkin, what)
  const dropped = new Set(drop ?? [])
  for (const node of part.getRoot().listNodes()) if (dropped.has(node.getName())) node.dispose()
  const { shifted } = refit(part, skin, partSkin)
  const settled = onSkin ? -settleOnSkin(part, onSkin, clearance).deepest : 0
  const top = highest(part)

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const merged = mergeDocuments(doc, part)
  let worn = 0
  for (const node of part.getRoot().listNodes()) {
    if (!node.getMesh()) continue
    const moved = merged.get(node)
    moved.setSkin(skin)
    if (name) moved.setName(worn ? `${name}_${worn}` : name)
    worn++
    scene.addChild(moved)
  }
  if (name && worn !== 1) throw new Error(`${what}: ${worn} meshes, expected one to name ${name}`)
  // the part brought a second copy of the skeleton with it; the joints it
  // pointed at go with the pruning
  merged.get(partSkin).dispose()
  return { shifted, top, settled }
}

/**
 * Puts this outfit's repainted sheets on the garments and gives them their
 * finish. The pack's own metal map goes: it marks buckles and studs metallic,
 * and a jacket that is partly chrome still catches the light after the shine
 * is painted out. What replaces it is cloth: no metal at all, and a roughness
 * read off this outfit's own sheet, so each fabric answers the street at its
 * own level and the weave breaks the highlight up as the body moves.
 */
async function recolour(doc, painter, id) {
  const sheets = await painter.finish()
  const told = []
  for (const [family, sheet] of sheets) {
    let dressed = 0
    for (const material of doc.getRoot().listMaterials()) {
      if (material.getName() !== `MI_${family}`) continue
      material.getBaseColorTexture().setImage(sheet.png).setMimeType('image/png')
      material
        .setMetallicRoughnessTexture(sheetOf(doc, `${id}-${family}-rough`, sheet.rough))
        .setMetallicFactor(finish.metalness)
        .setRoughnessFactor(finish.roughness)
      if (sheet.glow) {
        material
          .setEmissiveTexture(sheetOf(doc, `${id}-${family}-glow`, sheet.glow))
          .setEmissiveFactor([finish.accent, finish.accent, finish.accent])
      }
      dressed++
    }
    if (!dressed) throw new Error(`${id}: repainted ${family} but no material wears it`)
    const worked = [...sheet.changed].map(([fabric, count]) => `${fabric} ${(count / 1000).toFixed(0)}k`)
    told.push(
      `${family}: ${worked.join(', ')}${sheet.glow ? ', lit' : ''}, rough ` +
        `${(sheet.lowest * finish.roughness).toFixed(2)}-${(sheet.highest * finish.roughness).toFixed(2)}`,
    )
  }
  return told.join('; ')
}

/** One of the sheets a garment is read off, as a texture in the finished file. */
function sheetOf(doc, name, png) {
  return doc.createTexture(name).setImage(png).setMimeType('image/png')
}

/** One scene, one buffer, no duplicate textures, nothing unreferenced. */
async function tidy(doc) {
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  for (const other of root.listScenes()) if (other !== scene) other.dispose()
  root.setDefaultScene(scene)

  const buffers = root.listBuffers()
  for (const accessor of root.listAccessors()) accessor.setBuffer(buffers[0])
  for (const buffer of buffers.slice(1)) buffer.dispose()

  await doc.transform(dedup(), prune())
}

/**
 * Textures down to 1024 WebP through the CLI (it owns the image encoder), then
 * meshopt here, because the scene-wide quantization volume that keeps the whole
 * character on one skin is not a CLI flag.
 */
async function write(doc, target) {
  const raw = `${target}.raw.glb`
  const textured = `${target}.textured.glb`
  await reader.io.write(raw, doc)
  const quiet = { stdio: ['ignore', 'ignore', 'inherit'] }
  execFileSync('npx', ['gltf-transform', 'resize', raw, textured, '--width', '1024', '--height', '1024'], quiet)
  execFileSync('npx', ['gltf-transform', 'webp', textured, textured], quiet)

  const packed = await reader.io.read(textured)
  await packed.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizationVolume: 'scene' }))
  // last, because quantization re-sorts the skin weights and leaves them short again
  const evened = normalizeWeights(packed)
  await reader.io.write(target, packed)
  rmSync(raw)
  rmSync(textured)
  return evened
}

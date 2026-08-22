/**
 * Builds the dressed people the game loads. For every outfit in
 * game/cast/wardrobe.json this merges the base body with the outfit's parts
 * into one finished character GLB: the body geometry the clothes cover is
 * dropped, every part is moved onto the body's own skin, and the whole
 * character is quantized against one scene-wide volume so the file carries a
 * single skeleton. Nothing is bound at runtime.
 *
 * It also writes assets/dist/wardrobe.json: the list the game fetches, saying
 * which file to load and who each outfit suits.
 *
 * Run: node tools/build-wardrobe.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { compactPrimitive, dedup, mergeDocuments, meshopt, prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
await MeshoptEncoder.ready

const manifest = JSON.parse(readFileSync(join(ROOT, 'game', 'cast', 'wardrobe.json'), 'utf8'))
mkdirSync(OUT, { recursive: true })

const characters = []
for (const outfit of manifest.outfits) {
  const bodyFile = manifest.bodies[outfit.body]
  if (!bodyFile) throw new Error(`outfit ${outfit.id}: no body named ${outfit.body}`)

  const doc = await readPatched(join(SRC, bodyFile))
  const skin = doc.getRoot().listSkins()[0]
  if (!skin) throw new Error(`${bodyFile}: no skin`)
  const kept = trimCovered(doc, skin)

  let shifted = 0
  let collar = -Infinity
  for (const part of outfit.parts) {
    const worn = await wear(doc, skin, join(SRC, outfit.dir, `${part}.gltf`))
    shifted = Math.max(shifted, worn.shifted)
    collar = Math.max(collar, worn.top)
  }
  await tidy(doc)
  if (kept > collar) {
    throw new Error(
      `${outfit.id}: bare skin reaches down to y=${kept.toFixed(3)} but the clothes stop at ` +
        `y=${collar.toFixed(3)}, which leaves a gap at the neck`,
    )
  }

  const file = `characters/${outfit.id}.glb`
  await write(doc, join(DIST, file))
  characters.push({
    id: outfit.id,
    body: outfit.body,
    file,
    roles: outfit.roles,
    themes: outfit.themes,
  })
  console.log(
    `${outfit.id}: ${outfit.parts.length} parts refitted by up to ${(shifted * 100).toFixed(1)} cm,` +
      ` bare skin kept down to y=${kept.toFixed(3)} m` +
      ` -> ${(statSync(join(DIST, file)).size / 1e6).toFixed(2)} MB`,
  )
}

writeFileSync(join(DIST, 'wardrobe.json'), `${JSON.stringify({ characters }, null, 2)}\n`)
console.log(`${characters.length} characters + wardrobe.json -> ${DIST}`)

/**
 * Reads a glTF, resolving texture names the pack references but does not ship
 * under that name (T_Eye_Normal_png.png against T_Eye_Normal.png), rather than
 * editing files we did not write.
 */
async function readPatched(file) {
  const json = JSON.parse(readFileSync(file, 'utf8'))
  const dir = dirname(file)
  const resources = {}
  for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (!item.uri) continue
    resources[item.uri] = readFileSync(join(dir, nearest(dir, item.uri)))
  }
  return io.readJSON({ json, resources })
}

function nearest(dir, uri) {
  const named = decodeURIComponent(uri)
  if (existsSync(join(dir, named))) return named
  const alias = named.replace(/_png\.png$/, '.png')
  if (existsSync(join(dir, alias))) return alias
  throw new Error(`${uri}: no such file next to ${dir}`)
}

/**
 * Drops every triangle of the base body that no bare bone drives, so what is
 * left is the head and the neck the collar closes over. Returns the lowest
 * point still on the body, which has to sit under the outfit's collar.
 */
function trimCovered(doc, skin) {
  const joints = skin.listJoints().map((joint) => joint.getName())
  const bare = new Set(joints.flatMap((name, index) => (BARE.has(name) ? [index] : [])))
  let lowest = Infinity

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      const indices = prim.getIndices()
      if (!position || !indices) continue

      const skinIndex = prim.getAttribute('JOINTS_0')
      const skinWeight = prim.getAttribute('WEIGHTS_0')
      // a vertex stays if the bare bones drive most of it; the triangles that
      // straddle the line stay too, so the rim reaches a little under the collar
      const keep = new Uint8Array(position.getCount())
      for (let vertex = 0; vertex < keep.length; vertex++) {
        const bones = skinIndex.getElement(vertex, [])
        const weights = skinWeight.getElement(vertex, [])
        const mine = bones.reduce((sum, bone, slot) => (bare.has(bone) ? sum + weights[slot] : sum), 0)
        const total = weights.reduce((sum, weight) => sum + weight, 0)
        keep[vertex] = mine > total / 2 ? 1 : 0
      }

      const source = indices.getArray()
      const surviving = []
      for (let i = 0; i < source.length; i += 3) {
        if (!keep[source[i]] && !keep[source[i + 1]] && !keep[source[i + 2]]) continue
        surviving.push(source[i], source[i + 1], source[i + 2])
      }
      indices.setArray(new Uint32Array(surviving))
      compactPrimitive(prim)

      const trimmed = prim.getAttribute('POSITION')
      lowest = Math.min(lowest, trimmed.getMin([])[1])
    }
  }
  return lowest
}

/** Merges one outfit part in, refits it to the body and moves it onto the body's own skin. */
async function wear(doc, skin, file) {
  const part = await readPatched(file)
  const partSkin = part.getRoot().listSkins()[0]
  if (!partSkin) throw new Error(`${file}: no skin`)
  agree(skin, partSkin, file)
  const { shifted, top } = refit(part, skin, partSkin)

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const merged = mergeDocuments(doc, part)
  for (const node of part.getRoot().listNodes()) {
    if (!node.getMesh()) continue
    const moved = merged.get(node)
    moved.setSkin(skin)
    scene.addChild(moved)
  }
  // the part brought a second copy of the skeleton with it; the joints it
  // pointed at go with the pruning
  merged.get(partSkin).dispose()
  return { shifted, top }
}

/** The build gate for a part: same joints, in the same order. */
function agree(skin, other, file) {
  const mine = skin.listJoints().map((joint) => joint.getName())
  const theirs = other.listJoints().map((joint) => joint.getName())
  const wrong = theirs.findIndex((name, index) => name !== mine[index])
  if (theirs.length !== mine.length || wrong >= 0) {
    throw new Error(`${file}: joint ${wrong} is ${theirs[wrong]}, expected ${mine[wrong]}`)
  }
}

/**
 * Moves a part's geometry from the rest pose it was modelled on to the body's
 * own. The two packs share the skeleton but not its proportions: this body is
 * two to four centimetres broader at the shoulders and hips, so clothes left in
 * their own rest pose would need their own bind matrices and would still sit
 * off the shoulder. Each vertex is blended through its bones' rest difference,
 * which is what lets every part share the body's one skin.
 *
 * Returns how far the furthest vertex moved and the highest point of the part,
 * both in metres.
 */
function refit(part, skin, partSkin) {
  const body = skin.getInverseBindMatrices().getArray()
  const worn = partSkin.getInverseBindMatrices().getArray()
  const delta = []
  for (let joint = 0; joint * 16 < body.length; joint++) {
    delta.push(multiply(invert(body.slice(joint * 16, joint * 16 + 16)), worn.slice(joint * 16, joint * 16 + 16)))
  }

  let shifted = 0
  let top = -Infinity
  for (const mesh of part.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      const normal = prim.getAttribute('NORMAL')
      const tangent = prim.getAttribute('TANGENT')
      const bones = prim.getAttribute('JOINTS_0')
      const weights = prim.getAttribute('WEIGHTS_0')

      for (let vertex = 0; vertex < position.getCount(); vertex++) {
        const blended = blend(delta, bones.getElement(vertex, []), weights.getElement(vertex, []))
        const before = position.getElement(vertex, [])
        const after = apply(blended, before, 1)
        shifted = Math.max(shifted, Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]))
        position.setElement(vertex, after)
        top = Math.max(top, after[1])
        if (normal) normal.setElement(vertex, unit(apply(blended, normal.getElement(vertex, []), 0)))
        if (tangent) {
          const t = tangent.getElement(vertex, [])
          tangent.setElement(vertex, [...unit(apply(blended, t, 0)), t[3]])
        }
      }
    }
  }
  return { shifted, top }
}

/** Column-major 4x4 helpers, enough to blend rest poses. */
function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k]
    }
  }
  return out
}

/**
 * Weights in these packs do not always add up to one (0.925 shows up in the
 * ranger), so they are normalized here; unnormalized weights would drag the
 * vertex toward the origin by the shortfall.
 */
function blend(delta, bones, weights) {
  const total = weights[0] + weights[1] + weights[2] + weights[3]
  if (!total) return IDENTITY
  const out = new Array(16).fill(0)
  for (let slot = 0; slot < 4; slot++) {
    const weight = weights[slot] / total
    if (!weight) continue
    const matrix = delta[bones[slot]]
    for (let k = 0; k < 16; k++) out[k] += matrix[k] * weight
  }
  return out
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function apply(m, v, w) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * w,
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * w,
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * w,
  ]
}

function unit(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m
  const b00 = a00 * a11 - a01 * a10
  const b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11
  const b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30
  const b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31
  const b11 = a22 * a33 - a23 * a32

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (!det) throw new Error('a bind matrix is not invertible')
  const t = 1 / det

  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * t,
    (a02 * b10 - a01 * b11 - a03 * b09) * t,
    (a31 * b05 - a32 * b04 + a33 * b03) * t,
    (a22 * b04 - a21 * b05 - a23 * b03) * t,
    (a12 * b08 - a10 * b11 - a13 * b07) * t,
    (a00 * b11 - a02 * b08 + a03 * b07) * t,
    (a32 * b02 - a30 * b05 - a33 * b01) * t,
    (a20 * b05 - a22 * b02 + a23 * b01) * t,
    (a10 * b10 - a11 * b08 + a13 * b06) * t,
    (a01 * b08 - a00 * b10 - a03 * b06) * t,
    (a30 * b04 - a31 * b02 + a33 * b00) * t,
    (a21 * b02 - a20 * b04 - a23 * b00) * t,
    (a11 * b07 - a10 * b09 - a12 * b06) * t,
    (a00 * b09 - a01 * b07 + a02 * b06) * t,
    (a31 * b01 - a30 * b03 - a32 * b00) * t,
    (a20 * b03 - a21 * b01 + a22 * b00) * t,
  ]
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
  await io.write(raw, doc)
  const quiet = { stdio: ['ignore', 'ignore', 'inherit'] }
  execFileSync('npx', ['gltf-transform', 'resize', raw, textured, '--width', '1024', '--height', '1024'], quiet)
  execFileSync('npx', ['gltf-transform', 'webp', textured, textured], quiet)

  const packed = await io.read(textured)
  await packed.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizationVolume: 'scene' }))
  await io.write(target, packed)
  rmSync(raw)
  rmSync(textured)
}

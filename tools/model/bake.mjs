/**
 * Paints a model's texture sheets onto its vertices and throws the images away.
 *
 * A pack that draws a whole car with one material has nowhere to put a sheet:
 * the colour has to ride on the geometry. Each vertex takes the colour of the
 * base sheet where its own UV lands, converted out of sRGB into the linear
 * space glTF wants a vertex colour in, and the material keeps its name so
 * whoever rigs the model can still tell paint from glass from a tyre.
 *
 * A vertex on the edge of a UV island sits exactly on the seam, where the next
 * texel over belongs to another part of the car, so every sample is pulled a
 * quarter of the way towards the middle of the triangles that use it.
 */
import sharp from 'sharp'
import { prune } from '@gltf-transform/functions'

/** How far a sample is pulled off a UV island's edge, towards its own triangles. */
const INSET = 0.25

/** Every image slot a material can carry: the sheets all go, not just the colour. */
const SLOTS = ['BaseColor', 'Emissive', 'MetallicRoughness', 'Normal', 'Occlusion']

/**
 * @param {import('@gltf-transform/core').Document} document
 * @returns {Promise<{ painted: number, flat: number, sheets: number }>} primitives
 * sampled off a sheet, primitives given their material's flat colour, sheets read.
 */
export async function bakeVertexColour(document) {
  const root = document.getRoot()
  const sheets = new Map()
  let painted = 0
  let flat = 0

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1]
      const texture = material?.getBaseColorTexture() ?? null
      const set = material?.getBaseColorTextureInfo()?.getTexCoord() ?? 0
      const uv = texture ? primitive.getAttribute(`TEXCOORD_${set}`) : null
      const sheet = uv ? await pixelsOf(texture, sheets) : null

      const position = primitive.getAttribute('POSITION')
      const count = position.getCount()
      const was = primitive.getAttribute('COLOR_0')
      const colours = new Float32Array(count * 4)
      const middles = sheet ? islandInset(primitive, uv, count) : null

      const texel = [0, 0, 0, 1]
      const point = [0, 0]
      const worn = [1, 1, 1, 1]
      for (let i = 0; i < count; i++) {
        if (sheet) {
          uv.getElement(i, point)
          const middle = middles[i]
          sample(sheet, point[0] + (middle[0] - point[0]) * INSET, point[1] + (middle[1] - point[1]) * INSET, texel)
        } else {
          texel[0] = texel[1] = texel[2] = 1
          texel[3] = 1
        }
        if (was) was.getElement(i, worn)
        for (let k = 0; k < 3; k++) colours[i * 4 + k] = texel[k] * factor[k] * (was ? worn[k] : 1)
        colours[i * 4 + 3] = 1
      }

      const accessor = document.createAccessor().setType('VEC4').setArray(colours)
      primitive.setAttribute('COLOR_0', accessor)
      if (sheet) painted++
      else flat++
    }
  }

  for (const material of root.listMaterials()) {
    material.setBaseColorFactor([1, 1, 1, 1])
    for (const slot of SLOTS) {
      if (material[`get${slot}Texture`]() !== null) material[`set${slot}Texture`](null)
    }
  }
  await document.transform(prune({ keepAttributes: true }))
  return { painted, flat, sheets: sheets.size }
}

/** The UV every vertex is pulled towards: the middle of the triangles that use it. */
function islandInset(primitive, uv, count) {
  const middles = Array.from({ length: count }, () => [0, 0])
  const shares = new Float64Array(count)
  const indices = primitive.getIndices()
  const total = indices ? indices.getCount() : count
  const corner = [0, 0]
  for (let i = 0; i < total; i += 3) {
    const abc = [0, 1, 2].map((k) => (indices ? indices.getScalar(i + k) : i + k))
    let u = 0
    let v = 0
    for (const at of abc) {
      uv.getElement(at, corner)
      u += corner[0] / 3
      v += corner[1] / 3
    }
    for (const at of abc) {
      middles[at][0] += u
      middles[at][1] += v
      shares[at]++
    }
  }
  for (let i = 0; i < count; i++) {
    if (shares[i] === 0) continue
    middles[i][0] /= shares[i]
    middles[i][1] /= shares[i]
  }
  return middles
}

/** One texel, linear, wrapping the way a repeating sheet does. */
function sample(sheet, u, v, out) {
  const { width, height, data } = sheet
  const x = Math.min(width - 1, Math.max(0, Math.floor(wrap(u) * width)))
  const y = Math.min(height - 1, Math.max(0, Math.floor(wrap(v) * height)))
  const at = (y * width + x) * 4
  for (let k = 0; k < 3; k++) out[k] = linear(data[at + k] / 255)
  out[3] = data[at + 3] / 255
}

function wrap(t) {
  const f = t - Math.floor(t)
  return f < 0 ? f + 1 : f
}

/** sRGB out of the sheet, linear into the vertices, which is what glTF means by both. */
function linear(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

async function pixelsOf(texture, sheets) {
  const known = sheets.get(texture)
  if (known) return known
  const image = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const read = { width: image.info.width, height: image.info.height, data: image.data }
  sheets.set(texture, read)
  return read
}

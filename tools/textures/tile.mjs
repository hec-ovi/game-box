/**
 * Turns one generated image into a surface tile that repeats without a seam,
 * and measures whether it worked.
 *
 * Run: node tools/textures/tile.mjs <image> <outdir> [--metres 2] [--tame 0.3]
 *      [--flatten 0.6] [--pot]
 *
 * Writes <name>-tile.png (the tile), <name>-4x4.png and <name>-4x4-raw.png
 * (repeat sheets, after and before), and <name>-scale.png (the tile on an
 * 8 m wall with a 2.1 m door drawn on it).
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'

// ---------- a float image ----------

class Img {
  /** @param {number} w @param {number} h @param {Float32Array} data three channels, 0..255 */
  constructor(w, h, data) { this.w = w; this.h = h; this.data = data }

  static async read(path) {
    const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    return new Img(info.width, info.height, Float32Array.from(data))
  }

  get bytes() {
    const b = Buffer.alloc(this.w * this.h * 3)
    for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(this.data[i])))
    return b
  }

  write(path) {
    return sharp(this.bytes, { raw: { width: this.w, height: this.h, channels: 3 } }).png().toFile(path)
  }

  at(x, y, c) { return this.data[(y * this.w + x) * 3 + c] }
  set(x, y, c, v) { this.data[(y * this.w + x) * 3 + c] = v }

  crop(x0, y0, w, h) {
    const out = new Img(w, h, new Float32Array(w * h * 3))
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++)
      out.set(x, y, c, this.at(x0 + x, y0 + y, c))
    return out
  }

  transpose() {
    const out = new Img(this.h, this.w, new Float32Array(this.w * this.h * 3))
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) for (let c = 0; c < 3; c++)
      out.set(y, x, c, this.at(x, y, c))
    return out
  }

  /** Laid out cols by rows, which is how a repeat is inspected. */
  repeat(cols, rows) {
    const out = new Img(this.w * cols, this.h * rows, new Float32Array(this.w * cols * this.h * rows * 3))
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) for (let c = 0; c < 3; c++)
      out.set(x, y, c, this.at(x % this.w, y % this.h, c))
    return out
  }
}

// ---------- 1. take the light back out ----------

/** Separable box blur, three passes, which is close enough to a gaussian. */
function blur(img, radius) {
  let src = Float32Array.from(img.data) // a copy: the passes ping-pong and would eat the input
  let dst = new Float32Array(src.length)
  const { w, h } = img
  const n = radius * 2 + 1
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let x = -radius; x <= radius; x++) sum += src[(y * w + clamp(x, w)) * 3 + c]
      for (let x = 0; x < w; x++) {
        dst[(y * w + x) * 3 + c] = sum / n
        sum += src[(y * w + clamp(x + radius + 1, w)) * 3 + c] - src[(y * w + clamp(x - radius, w)) * 3 + c]
      }
    }
    ;[src, dst] = [dst, src]
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let y = -radius; y <= radius; y++) sum += src[(clamp(y, h) * w + x) * 3 + c]
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * 3 + c] = sum / n
        sum += src[(clamp(y + radius + 1, h) * w + x) * 3 + c] - src[(clamp(y - radius, h) * w + x) * 3 + c]
      }
    }
    ;[src, dst] = [dst, src]
  }
  return new Img(w, h, src)
}

const clamp = (v, n) => Math.max(0, Math.min(n - 1, v))

/**
 * Subtracts the very low frequencies and puts the average back. Kills a
 * vignette, a brighter side, and any soft shadow the model baked in. A tone
 * difference between two opposite edges survives every seam cut, and once the
 * tile repeats it shows up as a checkerboard.
 */
function flatten(img, strength) {
  const low = blur(img, Math.max(2, Math.round(img.w * 0.14)))
  const mean = [0, 0, 0]
  for (let i = 0; i < low.data.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += low.data[i + c]
  for (let c = 0; c < 3; c++) mean[c] /= img.w * img.h
  const out = new Img(img.w, img.h, new Float32Array(img.data.length))
  for (let i = 0; i < out.data.length; i += 3) for (let c = 0; c < 3; c++)
    out.data[i + c] = img.data[i + c] - strength * (low.data[i + c] - mean[c])
  return out
}

/**
 * Pulls the brightest few percent of pixels back towards the rest. Asked for
 * worn concrete, the model answers with bright mineral blooms, and a scatter of
 * near-white dots on a dark wall reads as speckled stone the moment the tile is
 * small on screen. Hue is kept; only how far a pixel sticks out is reduced.
 */
function tameHighlights(img, keep, percentile = 0.94) {
  if (keep >= 1) return img
  const lum = new Float32Array(img.w * img.h)
  for (let i = 0, p = 0; i < img.data.length; i += 3, p++)
    lum[p] = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]
  const cut = Float32Array.from(lum).sort()[Math.floor(lum.length * percentile)]
  const out = new Img(img.w, img.h, new Float32Array(img.data.length))
  for (let i = 0, p = 0; i < out.data.length; i += 3, p++) {
    const scale = lum[p] > cut ? (cut + (lum[p] - cut) * keep) / lum[p] : 1
    for (let c = 0; c < 3; c++) out.data[i + c] = img.data[i + c] * scale
  }
  return out
}

// ---------- 2. cut the wrap (Efros and Freeman, image quilting) ----------

/**
 * Makes the image wrap left to right. The strip that would fall off the right
 * edge is laid back over the left edge, and the two are cut along the path
 * where they already agree, so no detail is blurred away. A cross-fade over the
 * same overlap would ghost every feature in the band.
 */
function wrapX(img, overlap, feather = 2) {
  const { w, h } = img
  const M = w - overlap
  const cost = new Float64Array(overlap * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < overlap; x++) {
    let d = 0
    for (let c = 0; c < 3; c++) { const e = img.at(M + x, y, c) - img.at(x, y, c); d += e * e }
    cost[y * overlap + x] = d
  }
  const acc = Float64Array.from(cost)
  for (let y = 1; y < h; y++) for (let x = 0; x < overlap; x++) {
    let best = acc[(y - 1) * overlap + x]
    if (x > 0) best = Math.min(best, acc[(y - 1) * overlap + x - 1])
    if (x < overlap - 1) best = Math.min(best, acc[(y - 1) * overlap + x + 1])
    acc[y * overlap + x] = cost[y * overlap + x] + best
  }
  const path = new Int32Array(h)
  let px = 0
  for (let x = 1; x < overlap; x++) if (acc[(h - 1) * overlap + x] < acc[(h - 1) * overlap + px]) px = x
  path[h - 1] = px
  for (let y = h - 2; y >= 0; y--) {
    let best = px
    for (const nx of [px - 1, px, px + 1])
      if (nx >= 0 && nx < overlap && acc[y * overlap + nx] < acc[y * overlap + best]) best = nx
    path[y] = px = best
  }
  const out = new Img(M, h, new Float32Array(M * h * 3))
  for (let y = 0; y < h; y++) for (let x = 0; x < M; x++) for (let c = 0; c < 3; c++) {
    if (x >= overlap) { out.set(x, y, c, img.at(x, y, c)); continue }
    const t = Math.max(0, Math.min(1, (x - path[y] + feather) / (2 * feather + 1)))
    out.set(x, y, c, img.at(M + x, y, c) * (1 - t) + img.at(x, y, c) * t)
  }
  return out
}

const makeSeamless = (img, overlap) => wrapX(wrapX(img, overlap).transpose(), overlap).transpose()

/**
 * Resamples a tile that already wraps, without breaking the wrap: lay it out
 * three by three, resize that, keep the middle. A plain resize clamps at the
 * border and puts a faint seam back.
 */
async function resizeWrapped(img, size) {
  const three = img.repeat(3, 3)
  const out = await sharp(three.bytes, { raw: { width: three.w, height: three.h, channels: 3 } })
    .resize(size * 3, size * 3, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer()
  return new Img(size * 3, size * 3, Float32Array.from(out)).crop(size, size, size, size)
}

// ---------- 3. measurements that can fail ----------

/**
 * How different the wrap join is from an ordinary pair of neighbouring
 * columns or rows inside the tile. 1.0 means the join is as ordinary as any
 * other place. Past about 1.6 the eye starts finding the grid.
 */
function seamScore(img) {
  const { w, h } = img
  const diff = (ax, ay, bx, by) => {
    let d = 0
    for (let c = 0; c < 3; c++) d += Math.abs(img.at(ax, ay, c) - img.at(bx, by, c))
    return d / 3
  }
  let joinX = 0, joinY = 0, interX = 0, interY = 0
  for (let y = 0; y < h; y++) joinX += diff(w - 1, y, 0, y)
  for (let x = 0; x < w; x++) joinY += diff(x, h - 1, x, 0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) interX += diff(x, y, x + 1, y)
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) interY += diff(x, y, x, y + 1)
  return { x: (joinX / h) / (interX / (h * (w - 1))), y: (joinY / w) / (interY / (w * (h - 1))) }
}

/** Spread of average brightness over an 8 by 8 grid: how much light is baked in. */
function lightingSpread(img) {
  const cells = []
  const cw = Math.floor(img.w / 8), ch = Math.floor(img.h / 8)
  for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
    let s = 0
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const px = gx * cw + x, py = gy * ch + y
      s += 0.2126 * img.at(px, py, 0) + 0.7152 * img.at(px, py, 1) + 0.0722 * img.at(px, py, 2)
    }
    cells.push(s / (cw * ch))
  }
  const mean = cells.reduce((a, b) => a + b) / cells.length
  return ((Math.max(...cells) - Math.min(...cells)) / mean) * 100
}

/** The tile on an 8 m by 4 m wall with a 0.9 m by 2.1 m door drawn on it. */
function scaleSheet(img, metres, pxPerMetre = 128) {
  const W = 8 * pxPerMetre, H = 4 * pxPerMetre, tilePx = metres * pxPerMetre
  const out = new Img(W, H, new Float32Array(W * H * 3))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.floor(((x / tilePx) % 1) * img.w), sy = Math.floor(((y / tilePx) % 1) * img.h)
    for (let c = 0; c < 3; c++) out.set(x, y, c, img.at(sx, sy, c))
  }
  const dw = Math.round(0.9 * pxPerMetre), dh = Math.round(2.1 * pxPerMetre), x0 = pxPerMetre
  const mark = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    out.set(x, y, 0, 255); out.set(x, y, 1, 90); out.set(x, y, 2, 30)
  }
  for (let t = 0; t < 3; t++) {
    for (let x = x0; x < x0 + dw; x++) { mark(x, H - dh + t); mark(x, H - 1 - t) }
    for (let y = H - dh; y < H; y++) { mark(x0 + t, y); mark(x0 + dw - 1 - t, y) }
  }
  return out
}

// ---------- run ----------

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? fallback : Number(args[i + 1])
}
const [src, outDir] = args.filter((a) => !a.startsWith('--') && !Number.isFinite(Number(a)))
if (!src || !outDir) {
  console.error('usage: node tools/textures/tile.mjs <image> <outdir> [--metres 2] [--tame 0.3] [--flatten 0.6] [--pot]')
  process.exit(1)
}
const metres = flag('metres', 2)
const name = basename(src).replace(/\.[^.]+$/, '')
const report = (label, img) => {
  const s = seamScore(img)
  console.log(`${label.padEnd(8)} ${img.w}x${img.h}  seam x ${s.x.toFixed(2)} y ${s.y.toFixed(2)}  light spread ${lightingSpread(img).toFixed(1)}%`)
}

mkdirSync(outDir, { recursive: true })

const raw = await Img.read(src)
report('source', raw)

let tile = makeSeamless(flatten(tameHighlights(raw, flag('tame', 0.3)), flag('flatten', 0.6)), Math.round(raw.w / 8))
if (args.includes('--pot')) tile = await resizeWrapped(tile, 1 << Math.floor(Math.log2(tile.w)))
report('tile', tile)
console.log(`covers ${metres} m, ${(tile.w / metres).toFixed(0)} px per metre`)

await tile.write(join(outDir, `${name}-tile.png`))
await tile.repeat(4, 4).write(join(outDir, `${name}-4x4.png`))
await raw.repeat(4, 4).write(join(outDir, `${name}-4x4-raw.png`))
await scaleSheet(tile, metres).write(join(outDir, `${name}-scale.png`))
console.log(`wrote ${name}-tile.png, ${name}-4x4.png, ${name}-4x4-raw.png, ${name}-scale.png`)

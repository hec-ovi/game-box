/** Which graphics API handed a readback over. The two lay one out differently. */
export type Api = 'webgpu' | 'webgl'

/** Bytes per pixel in an RGBA readback. */
const BYTES = 4

/** WebGPU copies a texture out with every row padded up to a multiple of this. */
const ROW_ALIGN = 256

/**
 * A square RGBA readback as one picture: rows packed tight, top row first,
 * ready to hand to `putImageData`.
 *
 * The two APIs disagree twice over. WebGL reads a framebuffer from the bottom
 * left with its rows packed tight, so its first row is the bottom of the
 * picture. WebGPU copies a texture from the top left and pads every row out to
 * `ROW_ALIGN`, so at 288 pixels across a row occupies 1280 bytes and carries
 * 1152 of picture. Reading one buffer with the other's layout slides every row
 * sideways a little further than the last, which is a face shredded into
 * horizontal stripes.
 *
 * Nothing comes back where the buffer is short of a whole picture: a render
 * target never drawn into, or read at a size it was not made at, has no face in
 * it, and a panel with no face on it beats a panel with noise on it.
 */
export function pictureOf(
  pixels: ArrayBufferView,
  size: number,
  api: Api,
): Uint8ClampedArray<ArrayBuffer> | undefined {
  const row = size * BYTES
  const stride = api === 'webgpu' ? Math.ceil(row / ROW_ALIGN) * ROW_ALIGN : row
  // the last row is the picture's own width: nothing follows it to pad it out to
  const need = (size - 1) * stride + row
  if (size < 1 || pixels.byteLength < need) return undefined

  const from = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  const picture = new Uint8ClampedArray(size * row)
  for (let y = 0; y < size; y++) {
    const at = (api === 'webgpu' ? y : size - 1 - y) * stride
    picture.set(from.subarray(at, at + row), y * row)
  }
  return picture
}

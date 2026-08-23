/** Column-major 4x4 matrices, enough to blend one rest pose into another. */

export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k]
    }
  }
  return out
}

/** `w` is 1 for a point and 0 for a direction. */
export function apply(m, v, w) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * w,
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * w,
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * w,
  ]
}

export function unit(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

export function invert(m) {
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

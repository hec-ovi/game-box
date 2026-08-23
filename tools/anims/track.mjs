/**
 * One channel of a clip, readable at any moment rather than only on its own
 * keyframes.
 *
 * Two clips laid over each other almost never share a keyframe timeline, so
 * the one being added has to be asked where it is at the other's moments.
 */
import { slerp } from './skeleton.mjs'

const WIDTH = { rotation: 4, translation: 3, scale: 3 }

export class Track {
  #times
  #values
  #width
  #step

  /** @param {import('@gltf-transform/core').AnimationSampler} sampler */
  constructor(sampler, path) {
    const width = WIDTH[path]
    if (!width) throw new Error(`no idea how to sample a ${path} channel`)
    if (sampler.getInterpolation() === 'CUBICSPLINE') throw new Error('cubic keyframes are not sampled here')
    this.#times = sampler.getInput().getArray()
    this.#values = sampler.getOutput().getArray()
    this.#width = width
    this.#step = sampler.getInterpolation() === 'STEP'
  }

  get duration() {
    return this.#times[this.#times.length - 1]
  }

  get times() {
    return this.#times
  }

  /** The value at `time`, interpolated the way the renderer would. */
  at(time) {
    const times = this.#times
    let low = 0
    let high = times.length - 1
    while (low < high - 1) {
      const middle = (low + high) >> 1
      if (times[middle] <= time) low = middle
      else high = middle
    }
    const span = times[high] - times[low]
    const part = span > 0 ? Math.min(1, Math.max(0, (time - times[low]) / span)) : 0
    const before = this.#frame(low)
    if (this.#step || part === 0) return before
    const after = this.#frame(high)
    if (part === 1) return after
    if (this.#width === 4) return slerp(before, after, part)
    return before.map((value, axis) => value + (after[axis] - value) * part)
  }

  #frame(index) {
    const at = index * this.#width
    return Array.from(this.#values.slice(at, at + this.#width))
  }
}

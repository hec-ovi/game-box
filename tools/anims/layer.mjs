/**
 * One movement, measured from a pose, ready to be added to another clip.
 *
 * A clip is a set of poses; what can be added to a different body is the
 * difference between those poses and the one the movement started from. Which
 * pose it is measured from is the whole choice: its own first frame gives the
 * movement alone (a drink is raised and lowered, the arms stay where the other
 * clip had them), a plain standing idle gives the movement and the pose it is
 * held in (the arms go where this clip holds them, which is how a seated body
 * gets its hands onto a desk).
 */
import { conjugate, multiply } from './skeleton.mjs'
import { Track } from './track.mjs'

export class Layer {
  #turns = new Map()
  #duration = 0
  #times

  /**
   * @param {import('@gltf-transform/core').Animation} source the movement
   * @param {import('@gltf-transform/core').Animation} reference the pose it is measured from
   * @param {RegExp} bones which bones it may reach
   */
  constructor(source, reference, bones) {
    for (const channel of source.listChannels()) {
      const bone = channel.getTargetNode()?.getName()
      if (!bone || channel.getTargetPath() !== 'rotation' || !bones.test(bone)) continue
      const track = new Track(channel.getSampler(), 'rotation')
      this.#turns.set(bone, { track, from: conjugate(startOf(reference, bone)) })
      this.#duration = Math.max(this.#duration, track.duration)
      if (!this.#times || track.times.length > this.#times.length) this.#times = track.times
    }
    if (!this.#turns.size) throw new Error(`${source.getName()} turns none of the bones it was asked for`)
  }

  /** The keyframes of its busiest bone, which is the timeline a blend runs on. */
  get times() {
    return this.#times
  }

  get duration() {
    return this.#duration
  }

  reaches(bone) {
    return this.#turns.has(bone)
  }

  /** What this bone has to be turned by, `part` of the way through the clip being built. */
  deltaAt(bone, part) {
    const { track, from } = this.#turns.get(bone)
    const time = (part * this.#duration) % this.#duration
    return multiply(from, track.at(time))
  }
}

function startOf(reference, bone) {
  const channel = reference
    .listChannels()
    .find((one) => one.getTargetNode()?.getName() === bone && one.getTargetPath() === 'rotation')
  if (!channel) throw new Error(`${reference.getName()} does not turn ${bone}, so there is nothing to measure from`)
  return new Track(channel.getSampler(), 'rotation').at(0)
}

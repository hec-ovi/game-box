/**
 * Makes a loop out of one section of a clip.
 *
 * A pack's one-shot clips often pass through the pose a stance needs: a body
 * kneels, works for three seconds and stands back up. The middle of that is a
 * kneeling worker; the ends are not. This cuts the section out on the source's
 * own keyframes and, over the last `seam` seconds, eases every bone back to
 * the section's first frame, so the cut runs as a loop with no snap.
 *
 * `stretch` slows the section down.
 */
import { slerp } from './skeleton.mjs'
import { Track } from './track.mjs'

export class ClipTrimmer {
  #document
  #root
  #buffer

  constructor(document) {
    this.#document = document
    this.#root = document.getRoot()
    this.#buffer = this.#root.listBuffers()[0]
  }

  /** Adds one trimmed clip and returns it. Throws rather than shipping an empty section. */
  trim(spec) {
    const source = this.#root.listAnimations().find((animation) => animation.getName() === spec.from)
    if (!source) throw new Error(`${spec.name}: no clip called ${spec.from} to trim`)
    const stretch = spec.stretch ?? 1
    const seam = spec.seam ?? 0.3
    const times = this.#times(source, spec)
    const span = spec.end - spec.start
    if (seam >= span) throw new Error(`${spec.name}: a ${seam} s seam does not fit in ${span.toFixed(2)} s`)

    const clip = this.#document.createAnimation(spec.name)
    const input = this.#accessor(Float32Array.from(times, (time) => (time - spec.start) * stretch), 'SCALAR')
    for (const channel of source.listChannels()) {
      const bone = channel.getTargetNode()?.getName()
      const path = channel.getTargetPath()
      if (!bone || path === 'scale') continue
      const track = new Track(channel.getSampler(), path)
      const width = path === 'rotation' ? 4 : 3
      const first = track.at(spec.start)
      const values = new Float32Array(times.length * width)
      for (let frame = 0; frame < times.length; frame++) {
        let value = track.at(times[frame])
        const left = spec.end - times[frame]
        if (left < seam) value = ease(value, first, 1 - left / seam, width)
        values.set(value, frame * width)
      }
      const sampler = this.#document
        .createAnimationSampler()
        .setInput(input)
        .setInterpolation('LINEAR')
        .setOutput(this.#accessor(values, width === 4 ? 'VEC4' : 'VEC3'))
      clip.addSampler(sampler)
      clip.addChannel(this.#document.createAnimationChannel().setTargetNode(channel.getTargetNode()).setTargetPath(path).setSampler(sampler))
    }
    return clip
  }

  /** The source's keyframes inside the section, with the section's two ends added. */
  #times(source, spec) {
    const inside = new Set([spec.start, spec.end])
    for (const sampler of source.listSamplers()) {
      for (const time of sampler.getInput().getArray()) if (time > spec.start && time < spec.end) inside.add(time)
    }
    return [...inside].sort((a, b) => a - b)
  }

  #accessor(array, type) {
    return this.#document.createAccessor().setArray(array).setType(type).setBuffer(this.#buffer)
  }
}

/** `part` of the way from one keyframe value to another: the shorter arc for a rotation. */
function ease(from, to, part, width) {
  if (width === 4) return slerp(from, to, part)
  return from.map((value, axis) => value + (to[axis] - value) * part)
}

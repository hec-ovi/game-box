/**
 * Makes a new clip by laying one clip's movement over another clip's stance.
 *
 * The stances a room needs are not the clips a free pack publishes: nobody
 * gives away "sat at a bar raising a glass", but a pack does give away a
 * seated idle and a standing drink. Laying the second over the first is the
 * sum the gesture layer already does at runtime (`game/cast/src/gesture.ts`),
 * done once at build time instead: for every bone a movement reaches,
 *
 *     result(t) = stance(t) * (reference^-1 * movement(t))
 *
 * The clip runs on the first movement's keyframes, stretched if the spec asks
 * for it, with the stance looped a whole number of times underneath, so a clip
 * made out of two loops is still a loop. `hold` freezes the stance at one
 * moment instead, which is how a clip that only passes through a pose (a body
 * getting up off the floor) becomes a clip that stays in it.
 */
import { Layer } from './layer.mjs'
import { multiply } from './skeleton.mjs'
import { Track } from './track.mjs'

/** Which bones a movement is allowed to reach. */
export const TORSO = /^(spine_|neck_|Head$)/
export const ARMS = /^(clavicle_|upperarm_|lowerarm_|hand_|index_|middle_|pinky_|ring_|thumb_)/
export const UPPER = new RegExp(`${TORSO.source}|${ARMS.source}`)

export class MotionBlender {
  #document
  #root
  #buffer

  constructor(document) {
    this.#document = document
    this.#root = document.getRoot()
    this.#buffer = this.#root.listBuffers()[0]
  }

  /** Adds one blended clip and returns it. Throws rather than shipping a clip nothing drives. */
  blend(spec) {
    const stance = this.#stance(spec)
    const layers = spec.add.map(
      (movement) =>
        new Layer(
          this.#clip(spec.name, movement.clip),
          this.#clip(spec.name, movement.against ?? movement.clip),
          movement.bones ?? UPPER,
        ),
    )
    const stretch = spec.stretch ?? 1
    const times = Float32Array.from(layers[0].times, (time) => time * stretch)
    const duration = layers[0].duration * stretch
    const cycles = Math.max(1, Math.round(duration / stance.duration))

    const clip = this.#document.createAnimation(spec.name)
    const input = this.#accessor(times, 'SCALAR')
    for (const [key, channel] of stance.channels) {
      const [bone, path] = key.split('/')
      const values = this.#bake({ spec, bone, path, times, duration, cycles, stance, layers })
      const sampler = this.#document
        .createAnimationSampler()
        .setInput(input)
        .setInterpolation('LINEAR')
        .setOutput(this.#accessor(values, path === 'rotation' ? 'VEC4' : 'VEC3'))
      clip.addSampler(sampler)
      clip.addChannel(
        this.#document
          .createAnimationChannel()
          .setTargetNode(channel.getTargetNode())
          .setTargetPath(path)
          .setSampler(sampler),
      )
    }
    return clip
  }

  /** One channel's new values, frame by frame. */
  #bake({ spec, bone, path, times, duration, cycles, stance, layers }) {
    const track = stance.tracks.get(`${bone}/${path}`)
    const turning = path === 'rotation' ? layers.filter((layer) => layer.reaches(bone)) : []
    const shift = path === 'translation' ? (spec.shift?.[bone] ?? null) : null
    const width = path === 'rotation' ? 4 : 3
    const values = new Float32Array(times.length * width)

    for (let frame = 0; frame < times.length; frame++) {
      const part = times[frame] / duration
      let value = track.at(spec.hold ?? ((part * cycles * stance.duration) % stance.duration))
      for (const layer of turning) value = multiply(value, layer.deltaAt(bone, part))
      if (shift) value = value.map((metres, axis) => metres + shift[axis])
      values.set(value, frame * width)
    }
    return values
  }

  /** The clip that holds the body: its channels, its tracks, and how long it runs. */
  #stance(spec) {
    const source = this.#clip(spec.name, spec.base)
    const channels = new Map()
    const tracks = new Map()
    let duration = 0
    for (const channel of source.listChannels()) {
      const bone = channel.getTargetNode()?.getName()
      if (!bone) continue
      const path = channel.getTargetPath()
      const track = new Track(channel.getSampler(), path)
      channels.set(`${bone}/${path}`, channel)
      tracks.set(`${bone}/${path}`, track)
      duration = Math.max(duration, track.duration)
    }
    if (!duration) throw new Error(`${spec.name}: ${spec.base} holds no pose to build on`)
    for (const bone of Object.keys(spec.shift ?? {})) {
      if (bone !== 'root') throw new Error(`${spec.name}: a shift is metres in the character's own frame, so only the root can carry one`)
      if (!tracks.has(`${bone}/translation`)) throw new Error(`${spec.name}: ${spec.base} does not move ${bone}`)
    }
    return { channels, tracks, duration }
  }

  #clip(name, wanted) {
    const clip = this.#root.listAnimations().find((animation) => animation.getName() === wanted)
    if (!clip) throw new Error(`${name}: no clip called ${wanted}`)
    return clip
  }

  #accessor(array, type) {
    return this.#document.createAccessor().setArray(array).setType(type).setBuffer(this.#buffer)
  }
}

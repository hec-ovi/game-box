/**
 * Makes a new clip out of one the library already has, by holding some of the
 * bones at an angle for the whole of it.
 *
 * Nobody has published a CC0 wall lean on this skeleton, and the poses a street
 * needs are a standing idle with the spine tipped back and a leg moved, so they
 * are authored here rather than downloaded. The source clip's own breathing and
 * weight shift come through untouched, which is what keeps the result alive
 * instead of a statue.
 *
 * The offsets are written in the character's own frame: +Y up, +Z the way the
 * art faces in its own file, +X its left. `back` tips the crown away from the
 * face, `left` turns toward the left hand, `roll` tips onto the left shoulder.
 */
import { Skeleton, conjugate, multiply, rotate, turn } from './skeleton.mjs'

const UP = [0, 1, 0]
const FORWARD = [0, 0, 1]
const LEFT = [1, 0, 0]

export class PoseDeriver {
  #document
  #root
  #buffer
  #nodes

  constructor(document) {
    this.#document = document
    this.#root = document.getRoot()
    this.#buffer = this.#root.listBuffers()[0]
    this.#nodes = new Map(this.#root.listNodes().map((node) => [node.getName(), node]))
  }

  /** Adds one derived clip and returns it. Throws rather than shipping a pose nothing drives. */
  derive(spec) {
    const source = this.#root.listAnimations().find((animation) => animation.getName() === spec.from)
    if (!source) throw new Error(`${spec.name}: no clip called ${spec.from} to derive it from`)

    const channels = source.listChannels()
    const tracks = new Map()
    for (const channel of channels) {
      const bone = channel.getTargetNode()?.getName()
      if (bone) tracks.set(`${bone}/${channel.getTargetPath()}`, channel)
    }
    for (const bone of [...Object.keys(spec.turn ?? {}), ...Object.keys(spec.shift ?? {})]) {
      if (!tracks.has(`${bone}/rotation`)) throw new Error(`${spec.name}: ${spec.from} does not drive a bone called ${bone}`)
    }

    const rotations = new Map()
    for (const [key, channel] of tracks) {
      if (!key.endsWith('/rotation')) continue
      rotations.set(key.slice(0, -'/rotation'.length), channel.getSampler().getOutput().getArray())
    }
    const skeleton = new Skeleton(this.#topOf(channels), rotations)
    const frames = tracks.get('root/rotation').getSampler().getInput().getCount()

    const posed = this.#pose(spec, skeleton, rotations, frames)
    const shifted = this.#place(spec, skeleton, tracks, frames)

    const clip = this.#document.createAnimation(spec.name)
    for (const channel of channels) {
      const bone = channel.getTargetNode().getName()
      const path = channel.getTargetPath()
      const output = posed.get(`${bone}/${path}`) ?? shifted.get(`${bone}/${path}`)
      const sampler = this.#document
        .createAnimationSampler()
        .setInput(channel.getSampler().getInput())
        .setInterpolation('LINEAR')
        .setOutput(output ? this.#accessor(output, path === 'rotation' ? 'VEC4' : 'VEC3') : channel.getSampler().getOutput())
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

  /** The turned bones' new rotation tracks. */
  #pose(spec, skeleton, rotations, frames) {
    const out = new Map()
    const offsets = Object.entries(spec.turn ?? {}).map(([bone, angles]) => [bone, held(angles)])
    if (!offsets.length) return out
    for (const [bone] of offsets) out.set(`${bone}/rotation`, new Float32Array(rotations.get(bone)))

    for (let frame = 0; frame < frames; frame++) {
      const world = skeleton.worldRotations(frame)
      for (const [bone, held] of offsets) {
        const parent = skeleton.parentOf(bone)
        const frame4 = frame * 4
        // the same turn seen from the parent, so the bone's world orientation
        // ends up turned by exactly what the spec asked for
        const anchor = parent === undefined ? [0, 0, 0, 1] : world.get(parent)
        const local = multiply(multiply(conjugate(anchor), held), anchor)
        const track = out.get(`${bone}/rotation`)
        const was = rotations.get(bone)
        const turned = multiply(local, [was[frame4], was[frame4 + 1], was[frame4 + 2], was[frame4 + 3]])
        track.set(turned, frame4)
      }
    }
    return out
  }

  /** The moved bones' new translation tracks, in metres of the character's own frame. */
  #place(spec, skeleton, tracks, frames) {
    const out = new Map()
    for (const [bone, metres] of Object.entries(spec.shift ?? {})) {
      const channel = tracks.get(`${bone}/translation`)
      if (!channel) throw new Error(`${spec.name}: ${spec.from} does not move a bone called ${bone}`)
      const was = channel.getSampler().getOutput().getArray()
      const track = new Float32Array(was)
      const parent = skeleton.parentOf(bone)
      for (let frame = 0; frame < frames; frame++) {
        const anchor = parent === undefined ? [0, 0, 0, 1] : skeleton.worldRotations(frame).get(parent)
        const local = rotate(metres, conjugate(anchor))
        for (let axis = 0; axis < 3; axis++) track[frame * 3 + axis] = was[frame * 3 + axis] + local[axis]
      }
      out.set(`${bone}/translation`, track)
    }
    return out
  }

  #accessor(array, type) {
    return this.#document.createAccessor().setArray(array).setType(type).setBuffer(this.#buffer)
  }

  /** The one bone nothing else in the clip hangs off. */
  #topOf(channels) {
    const driven = new Set(channels.map((channel) => channel.getTargetNode()))
    for (const node of driven) if (!driven.has(node.getParentNode())) return node
    throw new Error('this clip drives no bone that is not somebody else\'s child')
  }
}

/** One spec's angles as a single turn in the character's own frame. */
function held({ back = 0, left = 0, roll = 0 }) {
  return multiply(multiply(turn(UP, left), turn(LEFT, -back)), turn(FORWARD, -roll))
}

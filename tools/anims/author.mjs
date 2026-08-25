/**
 * Builds the clips authored in this repo, in the order they are written.
 *
 * Three makers, told apart by the spec's shape: `base` is a blend (one clip's
 * movement laid over another's stance, blend.mjs), `from` with `start` and
 * `end` is a trim (a section of a clip closed into a loop, trim.mjs), and
 * `from` alone is a pose (bones held at an angle for the whole clip,
 * derive.mjs). A spec may build on any clip above it in the list, whichever
 * maker made that one, so a pose can be turned out of a blend and a blend laid
 * over a pose.
 */
import { MotionBlender } from './blend.mjs'
import { PoseDeriver } from './derive.mjs'
import { ClipTrimmer } from './trim.mjs'

export class ClipAuthor {
  #blender
  #deriver
  #trimmer

  constructor(document) {
    this.#blender = new MotionBlender(document)
    this.#deriver = new PoseDeriver(document)
    this.#trimmer = new ClipTrimmer(document)
  }

  /** Adds every authored clip to the document, in order. Returns their names. */
  author(specs) {
    return specs.map((spec) => this.#make(spec).getName())
  }

  #make(spec) {
    if (spec.base) return this.#blender.blend(spec)
    if (spec.start !== undefined) return this.#trimmer.trim(spec)
    return this.#deriver.derive(spec)
  }
}

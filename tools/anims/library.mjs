/**
 * Every source clip on one skeleton, with nothing but the clips left in it.
 *
 * Two source files mean two copies of the rig, and a loader that meets two
 * bones called `Head` renames the second one, so every clip pointing at that
 * copy would drive nothing and the NPC would stand in the rest pose. The first
 * file's skeleton is the one every clip is moved onto.
 */
import { NodeIO } from '@gltf-transform/core'
import { mergeDocuments } from '@gltf-transform/functions'

/** A rest pose is not a clip. */
const REST_POSE = 'A_TPose'

export class ClipLibrary {
  #io = new NodeIO()
  #document
  #root
  #canonical

  static async open(files) {
    const library = new ClipLibrary()
    await library.#read(files)
    return library
  }

  get document() {
    return this.#document
  }

  clips() {
    return this.#root.listAnimations().map((animation) => animation.getName())
  }

  bones() {
    return this.#root.listNodes().map((node) => node.getName())
  }

  async #read(files) {
    this.#document = await this.#io.read(files[0])
    this.#root = this.#document.getRoot()
    this.#canonical = new Map(this.#root.listNodes().map((node) => [node.getName(), node]))

    for (const file of files.slice(1)) {
      const known = new Set(this.#root.listNodes())
      mergeDocuments(this.#document, await this.#io.read(file))
      const copies = this.#root.listNodes().filter((node) => !known.has(node))
      this.#retarget(copies)
      for (const scene of this.#root.listScenes().slice(1)) scene.dispose()
      for (const node of copies) node.dispose()
    }
    this.#root.setDefaultScene(this.#root.listScenes()[0])
    for (const animation of this.#root.listAnimations()) {
      if (animation.getName() === REST_POSE) animation.dispose()
    }
  }

  /** Moves every channel that drives one of these nodes onto the bone of the same name. */
  #retarget(copies) {
    const strangers = new Set(copies)
    for (const animation of this.#root.listAnimations()) {
      for (const channel of animation.listChannels()) {
        const target = channel.getTargetNode()
        if (!target || !strangers.has(target)) continue
        const bone = this.#canonical.get(target.getName())
        if (!bone) throw new Error(`${animation.getName()}: no bone named ${target.getName()} on the canonical skeleton`)
        channel.setTargetNode(bone)
      }
    }
  }

  /** The clips are the point; the mannequin they were authored on is not. */
  stripArt() {
    for (const node of this.#root.listNodes()) node.setMesh(null)
    for (const mesh of this.#root.listMeshes()) mesh.dispose()
    for (const material of this.#root.listMaterials()) material.dispose()
    for (const texture of this.#root.listTextures()) texture.dispose()
    for (const skin of this.#root.listSkins()) skin.dispose()
  }

  /**
   * Drops every clip the game never names. The library is shipped whole to
   * every player, so a clip nobody plays is bandwidth for nothing.
   */
  keepOnly(names) {
    const wanted = new Set(names)
    const missing = [...wanted].filter((name) => !this.clips().includes(name))
    if (missing.length) throw new Error(`the game asks for clips no source has: ${missing.join(', ')}`)
    let dropped = 0
    for (const animation of this.#root.listAnimations()) {
      if (wanted.has(animation.getName())) continue
      // the channels and samplers are properties in their own right: drop the
      // animation alone and they keep every keyframe accessor alive
      for (const channel of animation.listChannels()) channel.dispose()
      for (const sampler of animation.listSamplers()) sampler.dispose()
      animation.dispose()
      dropped++
    }
    return dropped
  }

  /** A GLB carries one buffer; merging brought one per source file. */
  #oneBuffer() {
    const buffers = this.#root.listBuffers()
    for (const accessor of this.#root.listAccessors()) accessor.setBuffer(buffers[0])
    for (const buffer of buffers.slice(1)) buffer.dispose()
  }

  async write(target) {
    this.#oneBuffer()
    const names = this.bones()
    const twice = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
    if (twice.length) throw new Error(`${twice.length} bone name(s) appear twice: ${twice.join(', ')}`)
    await this.#io.write(target, this.#document)
    return names.length
  }
}

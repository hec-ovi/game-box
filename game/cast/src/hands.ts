import type * as THREE from 'three'
import { HANDHELD } from './props/handheld.ts'
import type { Props } from './props/props.ts'

/**
 * What one person has in their hands: the thing the playing clip is posed
 * around, parented to their own bone for as long as that clip plays.
 */
export class Hands {
  #body: THREE.Object3D
  #props: Props
  #bones = new Map<string, THREE.Object3D>()
  #holding: THREE.Object3D | undefined

  constructor(body: THREE.Object3D, props: Props) {
    this.#body = body
    this.#props = props
    body.traverse((child) => {
      if ((child as THREE.Bone).isBone) this.#bones.set(child.name, child)
    })
  }

  /** The thing in hand, or nothing. */
  get holding(): THREE.Object3D | undefined {
    return this.#holding
  }

  /** Give this person whatever the clip is posed around, or take away what they had. */
  forClip(clip: string): void {
    this.drop()
    const held = HANDHELD[clip]
    if (!held) return
    const parent = held.bone === 'body' ? this.#body : this.#bones.get(held.bone)
    if (!parent) return
    this.#holding = this.#props.make(held)
    parent.add(this.#holding)
  }

  drop(): void {
    this.#holding?.removeFromParent()
    this.#holding = undefined
  }
}

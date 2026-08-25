import * as THREE from 'three'
import { buildCigarette } from './cigarette.ts'
import { buildFood } from './food.ts'
import { buildGlass } from './glass.ts'
import type { Held, PropKind } from './handheld.ts'
import { buildPhone } from './phone.ts'
import { buildTorch } from './torch.ts'
import { buildTrolley } from './trolley.ts'

/**
 * The things people hold, built once and cloned per person. A clone shares
 * the geometry and the materials, so a bar of drinkers costs one glass.
 */
export class Props {
  #templates = new Map<string, THREE.Object3D>()

  /** A copy of the thing, placed for the bone it is going to hang off. */
  make(held: Held): THREE.Object3D {
    const key = `${held.prop}/${held.bone}`
    let template = this.#templates.get(key)
    if (!template) {
      template = build(held.prop, held.bone)
      this.#templates.set(key, template)
    }
    return template.clone()
  }
}

function build(prop: PropKind, bone: Held['bone']): THREE.Object3D {
  const hand = bone === 'body' ? 'hand_r' : bone
  switch (prop) {
    case 'phone':
      return buildPhone(hand)
    case 'glass':
      return buildGlass(hand)
    case 'food':
      return buildFood(hand)
    case 'cigarette':
      return buildCigarette()
    case 'torch':
      return buildTorch(hand)
    case 'trolley':
      return buildTrolley()
  }
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Npc } from '@gb/world'
import { ANCHOR_KINDS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cast, CLIP_FOR_ANCHOR, clipsUsed } from '../src/index.ts'

const DIST = join(import.meta.dirname, '..', '..', '..', 'assets', 'dist')

// three reaches for browser globals while decoding textures; the geometry and
// the clips do not need them
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

function read(path: string): ArrayBuffer {
  const bytes = readFileSync(path)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

const cast = await Cast.load({
  anims: read(join(DIST, 'anims.glb')),
  bodies: {
    male: read(join(DIST, 'bodies', 'Superhero_Male_FullBody.glb')),
    female: read(join(DIST, 'bodies', 'Superhero_Female_FullBody.glb')),
  },
})

function person(overrides: Partial<Npc> = {}): Npc {
  return {
    id: 'npc_0001',
    name: 'Mara Cole',
    role: 'bartender',
    appearance: { base: 'female', variant: 3 },
    personality: 'Dry, unhurried.',
    knowledge: ['The tide takes the low road twice a day.'],
    ...overrides,
  } as Npc
}

describe('Cast', () => {
  it('ships every clip the game asks for by name', () => {
    const missing = clipsUsed().filter((clip) => !cast.has(clip))
    expect(missing, `clips missing from the library: ${missing.join(', ')}`).toEqual([])
  })

  it('has something for every kind of anchor an NPC can stand on', () => {
    for (const kind of ANCHOR_KINDS) {
      expect(CLIP_FOR_ANCHOR[kind], `no clip for anchor kind ${kind}`).toBeTruthy()
      expect(cast.has(CLIP_FOR_ANCHOR[kind])).toBe(true)
    }
  })

  it('loads a body per kind, rigged, on the skeleton the clips were made for', () => {
    expect(cast.bodies().toSorted()).toEqual(['female', 'male'])

    const member = cast.spawn(person())
    let skinned: THREE.SkinnedMesh | undefined
    member.object.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinned = child as THREE.SkinnedMesh
    })
    expect(skinned, 'the body has no skinned mesh').toBeDefined()
    expect(skinned!.skeleton.bones.length).toBe(65)
    expect(skinned!.skeleton.bones[0]!.name).toBe('root')
  })

  it('gives each person their own skeleton, so they can do different things', () => {
    const first = cast.spawn(person({ id: 'npc_0001' }))
    const second = cast.spawn(person({ id: 'npc_0002', appearance: { base: 'male', variant: 5 } }))

    const boneOf = (member: { object: THREE.Object3D }) => {
      let bone: THREE.Bone | undefined
      member.object.traverse((child) => {
        if ((child as THREE.Bone).isBone && child.name === 'Head') bone = child as THREE.Bone
      })
      return bone
    }
    expect(boneOf(first)).toBeDefined()
    expect(boneOf(first)).not.toBe(boneOf(second))
    expect(first.object.name).toBe('npc_0001')
  })

  it('plays what the anchor implies and moves the pose when time passes', () => {
    const member = cast.spawn(person(), Cast.doingAt('serve'))
    expect(member.playing).toBe('Idle_Rail_Loop')

    const bones: THREE.Bone[] = []
    member.object.traverse((child) => {
      if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone)
    })
    const before = bones.map((bone) => bone.quaternion.clone())

    cast.update(0.5)
    member.object.updateMatrixWorld(true)
    const moved = bones.filter((bone, index) => bone.quaternion.angleTo(before[index]!) > 1e-4)
    expect(moved.length, 'nobody moved when time passed').toBeGreaterThan(4)
  })

  it('starts people at different points in the same loop', () => {
    const a = cast.spawn(person({ id: 'npc_0101' }))
    const b = cast.spawn(person({ id: 'npc_0102' }))
    cast.update(0.016)

    const poseOf = (member: { object: THREE.Object3D }) => {
      let bone: THREE.Bone | undefined
      member.object.traverse((child) => {
        if ((child as THREE.Bone).isBone && child.name === 'thigh_l') bone = child as THREE.Bone
      })
      return bone!.quaternion.clone()
    }
    expect(poseOf(a).angleTo(poseOf(b))).toBeGreaterThan(0)
  })

  it('ignores a clip it does not have rather than falling over', () => {
    const member = cast.spawn(person())
    const before = member.playing
    member.play('Backflip_Of_Doom')
    expect(member.playing).toBe(before)
  })
})

import { ANCHOR_KINDS, BODY_KINDS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cast, CastDressing, CastError, CLIPS_FOR_ANCHOR, clipsUsed } from '../src/index.ts'
import { animsBytes, loadCast, person, wardrobe } from './pack.ts'
import { posedBounds } from './posing.ts'

const cast = await loadCast()

describe('Cast', () => {
  it('ships every clip the game asks for by name', () => {
    const missing = clipsUsed().filter((clip) => !cast.has(clip))
    expect(missing, `clips missing from the library: ${missing.join(', ')}`).toEqual([])
  })

  it('has something for every kind of anchor an NPC can stand on', () => {
    for (const kind of ANCHOR_KINDS) {
      const shelf = CLIPS_FOR_ANCHOR[kind]
      expect(shelf.length, `no clip for anchor kind ${kind}`).toBeGreaterThan(0)
      for (const clip of shelf) expect(cast.has(clip), `${kind} names ${clip}, which the pack has not got`).toBe(true)
    }
  })

  it('gives one person the same idle every time and two people different ones', () => {
    const varied = ANCHOR_KINDS.filter((kind) => CLIPS_FOR_ANCHOR[kind].length > 1)
    expect(varied.length, 'no anchor kind offers a choice, so nothing varies').toBeGreaterThan(0)

    for (const kind of varied) {
      // a shared world file has to look the same to everyone who opens it
      expect(Cast.doingAt(kind, 'npc_0042')).toBe(Cast.doingAt(kind, 'npc_0042'))
      // and a room of them has to look like a room, not a chorus line
      const seen = new Set(Array.from({ length: 40 }, (_, n) => Cast.doingAt(kind, `npc_${n}`)))
      expect(seen, `everybody on a ${kind} anchor does the same thing`).toEqual(new Set(CLIPS_FOR_ANCHOR[kind]))
    }
    // nobody in mind: the stance's own first clip, never undefined
    for (const kind of ANCHOR_KINDS) expect(Cast.doingAt(kind)).toBe(CLIPS_FOR_ANCHOR[kind][0])
  })

  it('dresses everybody, on the skeleton the clips were made for', () => {
    for (const base of BODY_KINDS) {
      const member = cast.spawn(person({ id: `npc_${base}`, appearance: { base, variant: 1 } }))
      const entry = wardrobe.characters.find((candidate) => candidate.id === member.outfit)
      expect(entry, `${base} was given ${member.outfit}, which is not in the wardrobe`).toBeDefined()
      expect(entry!.body).toBe(base)

      const skinned: THREE.SkinnedMesh[] = []
      member.object.traverse((child) => {
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(child as THREE.SkinnedMesh)
      })
      expect(skinned.length, 'a dressed person is more than one mesh').toBeGreaterThan(3)
      for (const mesh of skinned) {
        expect(mesh.skeleton.bones.length).toBe(65)
        expect(mesh.skeleton.bones[0]!.name).toBe('root')
      }
    }
  })

  it('keeps the clothes on the body through a clip', () => {
    const member = cast.spawn(person({ id: 'npc_walker' }), 'Walk_Loop')
    cast.update(0.4)

    const bounds = posedBounds(member.object)
    const size = bounds.getSize(new THREE.Vector3())
    expect(bounds.min.y, 'somebody sank through the floor').toBeGreaterThan(-0.1)
    expect(bounds.max.y, 'somebody is not person-shaped').toBeLessThan(2.1)
    // a spike from a bad bind reads here: the widest a walking person gets is
    // arm's length, nothing like the metres a mis-bound vertex flies
    expect(size.x, 'a vertex flew off sideways').toBeLessThan(1.2)
    expect(size.z, 'a vertex flew off forwards').toBeLessThan(1.2)
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
    const member = cast.spawn(person({ id: 'npc_server' }), Cast.doingAt('serve'))
    expect(member.playing).toBe('Idle_Rail_Loop')

    const bones: THREE.Bone[] = []
    member.object.traverse((child) => {
      if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone)
    })
    const before = bones.map((bone) => bone.quaternion.clone())

    cast.update(0.5)
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
    const member = cast.spawn(person({ id: 'npc_0103' }))
    const before = member.playing
    member.play('Backflip_Of_Doom')
    expect(member.playing).toBe(before)
  })

  it('puts real people in the world and leaves the rest to the greybox', () => {
    const dressing = new CastDressing(cast)
    const npc = person({ id: 'npc_dressed' })
    const object = dressing.character(npc, 'lean')

    expect(dressing.members().get(npc.id)?.object).toBe(object)
    expect(dressing.members().get(npc.id)?.playing).toBe(Cast.doingAt('lean', npc.id))
    // everything that is not a person still comes from the box world
    expect(dressing.prop('table')).toBeInstanceOf(THREE.Object3D)
  })

  it('refuses a pack it cannot use', async () => {
    const anims = new ArrayBuffer(8)
    await expect(
      Cast.load({ anims, wardrobe: { characters: [] }, characters: {} }),
    ).rejects.toMatchObject({ code: 'unreadable-asset' })

    const real = { anims: animsBytes(), characters: {} }
    await expect(Cast.load({ ...real, wardrobe: { characters: [{ id: 'x' }] } })).rejects.toMatchObject({
      code: 'bad-wardrobe',
    })
    await expect(Cast.load({ ...real, wardrobe })).rejects.toMatchObject({ code: 'missing-character' })
    expect(new CastError('bad-wardrobe', 'wardrobe.json', 'no characters in it').message).toContain('wardrobe.json')
  })
})

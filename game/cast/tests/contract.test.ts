import { ANCHOR_KINDS, BODY_KINDS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cast, CastDressing, CastError, CLIP_FOR_ANCHOR, clipsUsed } from '../src/index.ts'
import { animsBytes, loadCast, person, wardrobe } from './pack.ts'

const cast = await loadCast()

/** Where a skinned mesh's vertices actually land once the pose is applied. */
function posedBounds(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const rest = new THREE.Vector3()
  const point = new THREE.Vector3()
  const posed = new THREE.Vector3()
  const bone = new THREE.Matrix4()

  object.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getAttribute('skinIndex')
    const weight = mesh.geometry.getAttribute('skinWeight')
    for (let vertex = 0; vertex < position.count; vertex++) {
      rest.fromBufferAttribute(position, vertex).applyMatrix4(mesh.bindMatrix)
      posed.set(0, 0, 0)
      for (let slot = 0; slot < 4; slot++) {
        const share = weight.getComponent(vertex, slot)
        if (!share) continue
        const joint = index.getComponent(vertex, slot)
        bone.multiplyMatrices(mesh.skeleton.bones[joint]!.matrixWorld, mesh.skeleton.boneInverses[joint]!)
        posed.add(point.copy(rest).applyMatrix4(bone).multiplyScalar(share))
      }
      box.expandByPoint(posed.applyMatrix4(mesh.bindMatrixInverse))
    }
  })
  return box
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
    expect(dressing.members().get(npc.id)?.playing).toBe(Cast.doingAt('lean'))
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

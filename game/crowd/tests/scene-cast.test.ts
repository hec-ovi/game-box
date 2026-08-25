import { CLIPS, buildFor } from '@gb/cast'
import type { Npc, NpcRole } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SceneCast } from '../src/index.ts'
import { StubCast } from './support/stub-cast.ts'

function walkerNpc(id: string, base: 'male' | 'female', variant: number, role: NpcRole = 'wanderer'): Npc {
  return {
    id,
    name: 'Passer-by',
    role,
    appearance: { base, variant },
    personality: 'Crossing town.',
    knowledge: [],
  }
}

describe('SceneCast', () => {
  it('parents a body to the root and moves, turns and animates it', () => {
    const root = new THREE.Object3D()
    const cast = new StubCast()
    const actor = new SceneCast(cast, root).spawn(walkerNpc('npc_900001', 'male', 3))

    actor.placeAt(4, 0.15, 9)
    actor.faceTo(Math.PI / 2)
    actor.play('Walk_Loop')
    actor.pace?.(1.3)

    const body = root.children[0]!
    expect(root.children.length).toBe(1)
    expect(body.position.toArray()).toEqual([4, 0.15, 9])
    expect(body.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(cast.spawned.length).toBe(1)
    expect(cast.members[0]!.playing).toBe('Walk_Loop')
    expect(cast.members[0]!.paced).toEqual([1.3])
  })

  it('takes a released body out of the scene and stops listening to it', () => {
    const root = new THREE.Object3D()
    const cast = new StubCast()
    const actor = new SceneCast(cast, root).spawn(walkerNpc('npc_900001', 'male', 3))
    actor.placeAt(4, 0, 9)
    const body = root.children[0]!

    actor.release()
    actor.placeAt(100, 0, 100)
    actor.pace?.(1.3)

    expect(root.children).toEqual([])
    expect(body.visible).toBe(false)
    expect(body.position.toArray()).toEqual([4, 0, 9])
    expect(cast.members[0]!.paced).toEqual([])
  })

  it('reuses a parked body of the same kind instead of asking the cast for another', () => {
    const cast = new StubCast()
    const root = new THREE.Object3D()
    const scene = new SceneCast(cast, root)

    const first = scene.spawn(walkerNpc('npc_900001', 'male', 3))
    const second = scene.spawn(walkerNpc('npc_900002', 'male', 7))
    first.release()
    second.release()
    expect(scene.parked).toBe(2)

    // the look asked for is parked, so that is the body that comes back
    scene.spawn(walkerNpc('npc_900003', 'male', 7))
    // this one is not, so a parked body of the same kind stands in rather than a new skeleton
    scene.spawn(walkerNpc('npc_900004', 'male', 9))
    // nothing female is parked, so the cast has to make one
    scene.spawn(walkerNpc('npc_900005', 'female', 1))

    expect(root.children.map((body) => body.name)).toEqual(['male/7', 'male/3', 'female/1'])
    expect(cast.spawned.map((npc) => npc.id)).toEqual(['npc_900001', 'npc_900002', 'npc_900005'])
    expect(scene.parked).toBe(0)
  })

  it('never puts a walker in a body of another build', () => {
    const cast = new StubCast()
    const root = new THREE.Object3D()
    const scene = new SceneCast(cast, root)
    // the cast builds a minority of the people whose work is physical heavier, and these two workers differ
    const heavy = walkerNpc('npc_900004', 'male', 3, 'worker')
    const regular = walkerNpc('npc_900000', 'male', 3, 'worker')
    expect(buildFor(heavy)).toBe('heavy')
    expect(buildFor(regular)).toBe('regular')

    scene.spawn(heavy).release()
    // the parked body is the wrong size for this one, so the cast makes a second rather than shrinking them
    scene.spawn(regular)
    expect(cast.spawned.map((npc) => npc.id)).toEqual([heavy.id, regular.id])
    expect(scene.members().get(regular.id)!.build).toBe('regular')
    expect(scene.parked).toBe(1)

    // and the parked heavy body is worn by the next heavy walker
    scene.spawn(walkerNpc('npc_900007', 'male', 3, 'worker'))
    expect(cast.spawned.length).toBe(2)
    expect(scene.members().get('npc_900007')).toBe(cast.members[0])
  })

  it('answers for whoever is wearing a body now, never for whoever wore it before', () => {
    const cast = new StubCast()
    const scene = new SceneCast(cast, new THREE.Object3D())

    const first = scene.spawn(walkerNpc('npc_900001', 'male', 3))
    expect(scene.members().get('npc_900001')).toBe(cast.members[0])

    first.release()
    expect(scene.members().get('npc_900001')).toBeUndefined()

    // the same body, back on the street as somebody else: it answers to the id wearing it
    scene.spawn(walkerNpc('npc_900002', 'male', 3))
    expect(cast.spawned.length).toBe(1)
    expect(scene.members().get('npc_900002')).toBe(cast.members[0])
    expect(scene.members().get('npc_900001')).toBeUndefined()
  })

  it('moves a body indoors under the room that is standing, out of sight when none is, and back onto the street', () => {
    const cast = new StubCast()
    const street = new THREE.Object3D()
    const room = new THREE.Object3D()
    const rooms = { root: (interiorId: string) => (interiorId === 'interior_0001' ? room : undefined) }
    const scene = new SceneCast(cast, street, rooms)
    const actor = scene.spawn(walkerNpc('npc_900001', 'male', 3))
    const body = cast.members[0]!.object

    actor.enter!('interior_0001')
    actor.placeAt(2.5, 0, 3)
    expect(street.children).toEqual([])
    expect(room.children).toEqual([body])
    expect(body.visible).toBe(true)
    expect(body.position.toArray()).toEqual([2.5, 0, 3])
    // still theirs while they are in there
    expect(scene.members().get('npc_900001')).toBe(cast.members[0])

    // a room nobody has built: not drawn anywhere until they come out
    actor.enter!('interior_0002')
    expect(room.children).toEqual([])
    expect(body.visible).toBe(false)

    actor.exit!()
    expect(street.children).toEqual([body])
    expect(body.visible).toBe(true)

    // retired from inside a room, the body is parked out of it
    actor.enter!('interior_0001')
    actor.release()
    expect(room.children).toEqual([])
    expect(scene.parked).toBe(1)
  })

  it('parks a body with its mouth shut and its hands down, whatever it was saying when it was retired', () => {
    const cast = new StubCast()
    const scene = new SceneCast(cast, new THREE.Object3D())
    const actor = scene.spawn(walkerNpc('npc_900001', 'male', 3))
    const member = cast.members[0]!

    member.gesture(CLIPS.talk)
    member.speak(true)
    expect(member.gesturing).toBe(CLIPS.talk)
    expect(member.speaking).toBe(true)

    // retired mid-sentence, then worn by the next passer-by, who is not talking to anybody
    actor.release()
    scene.spawn(walkerNpc('npc_900002', 'male', 3))
    expect(member.gesturing).toBeUndefined()
    expect(member.speaking).toBe(false)
  })
})

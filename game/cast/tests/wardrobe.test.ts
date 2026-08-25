import { BODY_KINDS, NPC_ROLES } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { chooseCharacter, parseWardrobe, type Wardrobe } from '../src/index.ts'
import { person, wardrobe } from './pack.ts'

const seaside: Wardrobe = {
  characters: [
    { id: 'male-diver', body: 'male', file: 'a.glb', roles: ['worker'], themes: ['harbour'], styles: [], brows: [] },
    { id: 'male-suit', body: 'male', file: 'b.glb', roles: ['clerk'], themes: ['office'], styles: [], brows: [] },
    { id: 'female-suit', body: 'female', file: 'c.glb', roles: ['clerk'], themes: ['office'], styles: [], brows: [] },
  ],
}

describe('the wardrobe', () => {
  it('dresses a role in what the role wears', () => {
    const worker = chooseCharacter(seaside, person({ id: 'npc_1', role: 'worker', appearance: { base: 'male', variant: 0 } }), '')
    const clerk = chooseCharacter(seaside, person({ id: 'npc_1', role: 'clerk', appearance: { base: 'male', variant: 0 } }), '')
    expect(worker.id).toBe('male-diver')
    expect(clerk.id).toBe('male-suit')
  })

  it('never puts somebody in an outfit cut for another body', () => {
    const her = chooseCharacter(seaside, person({ id: 'npc_2', role: 'worker', appearance: { base: 'female', variant: 0 } }), 'harbour')
    expect(her.body).toBe('female')
  })

  it('lets the theme break a tie between outfits that suit the role equally', () => {
    const both: Wardrobe = {
      characters: [
        { id: 'male-oilskin', body: 'male', file: 'a.glb', roles: ['patron'], themes: ['harbour'], styles: [], brows: [] },
        { id: 'male-linen', body: 'male', file: 'b.glb', roles: ['patron'], themes: ['desert'], styles: [], brows: [] },
      ],
    }
    const npc = person({ id: 'npc_3', role: 'patron', appearance: { base: 'male', variant: 0 } })
    expect(chooseCharacter(both, npc, 'A drowned harbour town').id).toBe('male-oilskin')
    expect(chooseCharacter(both, npc, 'A desert waystation').id).toBe('male-linen')
  })

  it('dresses the same person the same way every time the city is opened', () => {
    const npc = person({ id: 'npc_4', role: 'wanderer', appearance: { base: 'male', variant: 2 } })
    const once = chooseCharacter(wardrobe, npc, 'A quiet river town')
    const again = chooseCharacter(wardrobe, npc, 'A quiet river town')
    expect(again.id).toBe(once.id)
  })

  it('has something cut for every role the world can station, on every body kind', () => {
    for (const role of NPC_ROLES) {
      for (const base of BODY_KINDS) {
        const worn = chooseCharacter(wardrobe, person({ id: `npc_${role}_${base}`, role, appearance: { base, variant: 0 } }), '')
        expect(worn.body, `a ${base} ${role} is wearing ${worn.id}, which is cut for a ${worn.body}`).toBe(base)
        expect(worn.roles, `nothing in the wardrobe is made for a ${role}: they fell back to ${worn.id}`).toContain(role)
      }
    }
  })

  it('refuses a wardrobe the build did not write', () => {
    expect(() => parseWardrobe({ characters: [] })).toThrowError(/no characters/)
    expect(() => parseWardrobe({ characters: [{ id: 'x', body: 'lizard', file: 'x.glb', roles: [], themes: [], styles: [], brows: [] }] })).toThrowError(
      /not a body kind/,
    )
  })
})

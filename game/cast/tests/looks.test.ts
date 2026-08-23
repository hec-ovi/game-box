import { BODY_KINDS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { loadCast, person, wardrobe } from './pack.ts'

const cast = await loadCast()

interface Look {
  readonly outfit: string
  readonly hair: string
  readonly brows: string
  readonly beard: boolean
  readonly colour: string
  readonly materials: THREE.Material[]
}

/** What a spawned person actually renders: the pieces that are visible and the colour on them. */
function look(member: { object: THREE.Object3D; outfit: string }): Look {
  let hair = 'bald'
  let brows = 'none'
  let beard = false
  let colour = ''
  const materials: THREE.Material[] = []
  member.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible || Array.isArray(mesh.material)) return
    if (mesh.name.startsWith('hair_')) hair = mesh.name
    else if (mesh.name.startsWith('brows_')) brows = mesh.name
    else if (mesh.name.startsWith('beard_')) beard = true
    else return
    materials.push(mesh.material)
    colour = `#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`
  })
  return { outfit: member.outfit, hair, brows, beard, colour, materials }
}

const street = (count: number, base: 'male' | 'female') =>
  Array.from({ length: count }, (_, index) =>
    look(cast.spawn(person({ id: `npc_${base}_${index}`, role: 'resident', appearance: { base, variant: index % 8 } }))),
  )

describe('what a person is made of', () => {
  it('gives every material a base colour texture, so nobody renders white', () => {
    for (const entry of wardrobe.characters) {
      const member = cast.spawn(
        person({ id: `npc_paint_${entry.id}`, appearance: { base: entry.body, variant: 1 } }),
      )
      const seen = new Set<string>()
      member.object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh || Array.isArray(mesh.material)) return
        const material = mesh.material as THREE.MeshStandardMaterial
        seen.add(material.name)
        expect(material.map, `${entry.id}: ${mesh.name} draws ${material.name} with no base colour texture`).toBeTruthy()
        expect(material.map!.image, `${entry.id}: ${material.name}'s base colour texture carries no image`).toBeTruthy()
      })
      expect(seen.size, `${entry.id} has no materials at all`).toBeGreaterThan(3)
    }
  })

  it('colours the hair and the eyebrows together, instead of leaving the grey of the map', () => {
    for (const base of BODY_KINDS) {
      const haired = street(24, base).filter((one) => one.hair !== 'bald')
      expect(haired.length, `${base}: nobody on the street has hair`).toBeGreaterThan(10)
      for (const one of haired) {
        expect(one.brows, `${base}: hair but no eyebrows`).not.toBe('none')
        const colours = new Set(one.materials.map((material) => (material as THREE.MeshStandardMaterial).color.getHexString()))
        expect(colours.size, `${base}: the brows and the hair are different colours`).toBe(1)
        expect(one.colour, `${base}: the hair is still the white of the untinted map`).not.toBe('#ffffff')
      }
    }
  })
})

describe('how much a street varies', () => {
  it('cuts hair from the whole set, with bald one of the choices rather than the only one', () => {
    for (const base of BODY_KINDS) {
      const cuts = street(80, base).map((one) => one.hair)
      const styles = new Set(cuts)
      const bald = cuts.filter((cut) => cut === 'bald').length
      expect(styles.size, `${base}: only ${styles.size} hair choices on a street of 80`).toBeGreaterThanOrEqual(5)
      expect(bald, `${base}: nobody is bald, so bald is not a choice`).toBeGreaterThan(0)
      expect(bald, `${base}: ${bald} of 80 are bald, which is everybody`).toBeLessThan(40)
    }
  })

  it('spreads the hair colours across the palette', () => {
    for (const base of BODY_KINDS) {
      const colours = new Set(street(80, base).map((one) => one.colour))
      expect(colours.size, `${base}: a street of 80 has only ${colours.size} hair colours`).toBeGreaterThanOrEqual(8)
    }
  })

  it('shares the tinted materials, so a crowd does not cost one material each', () => {
    const worn = (count: number) => {
      const materials = new Set<THREE.Material>()
      for (const base of BODY_KINDS) for (const one of street(count, base)) for (const m of one.materials) materials.add(m)
      return materials.size
    }
    const few = worn(100)
    const many = worn(500)
    expect(many, `the palette grew with the crowd: ${few} materials for 200 people, ${many} for 1000`).toBe(few)
    expect(many, `${many} hair materials is more than the palette can account for`).toBeLessThan(80)
  })

  it('rarely puts two people with the same body, clothes, hair and colour on one street', () => {
    const looks = [...street(20, 'male'), ...street(20, 'female')].map(
      (one) => `${one.outfit}/${one.hair}/${one.brows}/${one.beard}/${one.colour}`,
    )
    expect(new Set(looks).size, `${40 - new Set(looks).size} of 40 people on a street are somebody else's twin`).toBeGreaterThan(37)
  })

  it('gives the same person the same head every time the city is opened', () => {
    const npc = person({ id: 'npc_regular', role: 'resident', appearance: { base: 'male', variant: 2 } })
    const once = look(cast.spawn(npc))
    const again = look(cast.spawn(npc))
    expect(again.hair).toBe(once.hair)
    expect(again.brows).toBe(once.brows)
    expect(again.beard).toBe(once.beard)
    expect(again.colour).toBe(once.colour)
  })
})

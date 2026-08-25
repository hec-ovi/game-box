import type { BodyKind } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BODIES, loadCast, person, wardrobe } from './pack.ts'

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

function meshNamed(object: THREE.Object3D, name: string | RegExp): THREE.Mesh {
  let found: THREE.Mesh | undefined
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && (typeof name === 'string' ? mesh.name === name : name.test(mesh.name))) found = mesh
  })
  if (!found) throw new Error(`no mesh named ${name}`)
  return found
}

/** The skin as a set of points with normals, in the bind space every piece was refitted into. */
function surfaceOf(skin: THREE.Mesh) {
  const position = skin.geometry.getAttribute('position') as THREE.BufferAttribute
  const normal = skin.geometry.getAttribute('normal') as THREE.BufferAttribute
  const points = Array.from({ length: position.count }, (_, v) => new THREE.Vector3().fromBufferAttribute(position, v))
  const normals = Array.from({ length: position.count }, (_, v) => new THREE.Vector3().fromBufferAttribute(normal, v))
  return {
    /** Signed distance off the nearest skin vertex along its normal; a point off the scalp reads as outside. */
    depthOf(point: THREE.Vector3): number {
      let best = Infinity
      let nearest = 0
      for (let v = 0; v < points.length; v++) {
        const d = points[v]!.distanceToSquared(point)
        if (d < best) {
          best = d
          nearest = v
        }
      }
      if (Math.sqrt(best) > 0.05) return Infinity
      return point.clone().sub(points[nearest]!).dot(normals[nearest]!)
    },
  }
}

const street = (count: number, base: BodyKind) =>
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

  /**
   * What the owner saw as bald people: the pack's hair is cut for a smaller
   * head than this body's, and worn as it comes two fifths of a buzz cut lies
   * under the scalp with only a patch showing. The build holds every piece
   * outside the skin; this reads the rest-pose geometry, which both were
   * refitted into, against the skin's own normals.
   */
  it('keeps every hairstyle, beard and added brow outside the skin, so a cut shows as a cut', () => {
    for (const entry of wardrobe.characters) {
      const member = cast.spawn(person({ id: `npc_scalp_${entry.id}`, role: entry.roles[0] as never, appearance: { base: entry.body, variant: 1 } }))
      const skin = meshNamed(member.object, /^Super/i)
      const surface = surfaceOf(skin)
      // the first pair of brows is the body's own, placed by the artist
      for (const piece of [...entry.styles, ...entry.brows.slice(1), ...(entry.beard ? [entry.beard] : [])]) {
        const hair = meshNamed(member.object, piece)
        const position = hair.geometry.getAttribute('position') as THREE.BufferAttribute
        let under = 0
        const point = new THREE.Vector3()
        for (let vertex = 0; vertex < position.count; vertex++) {
          if (surface.depthOf(point.fromBufferAttribute(position, vertex)) < -0.002) under++
        }
        expect(under / position.count, `${entry.id}: ${(100 * under / position.count).toFixed(0)}% of ${piece} is under the skin`).toBeLessThan(0.02)
      }
    }
  })

  it('colours the hair and the eyebrows together, instead of leaving the grey of the map', () => {
    for (const base of BODIES) {
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
    for (const base of BODIES) {
      const cuts = street(80, base).map((one) => one.hair)
      const styles = new Set(cuts)
      const bald = cuts.filter((cut) => cut === 'bald').length
      expect(styles.size, `${base}: only ${styles.size} hair choices on a street of 80`).toBeGreaterThanOrEqual(6)
      expect(bald, `${base}: nobody is bald, so bald is not a choice`).toBeGreaterThan(0)
      expect(bald, `${base}: ${bald} of 80 are bald, which is a barracks`).toBeLessThan(25)
    }
  })

  it('spreads the hair colours across the palette', () => {
    for (const base of BODIES) {
      const colours = new Set(street(80, base).map((one) => one.colour))
      expect(colours.size, `${base}: a street of 80 has only ${colours.size} hair colours`).toBeGreaterThanOrEqual(12)
    }
  })

  it('shares the tinted materials, so a crowd does not cost one material each', () => {
    const worn = (count: number) => {
      const materials = new Set<THREE.Material>()
      for (const base of BODIES) for (const one of street(count, base)) for (const m of one.materials) materials.add(m)
      return materials.size
    }
    const few = worn(100)
    const many = worn(500)
    expect(many, `the palette grew with the crowd: ${few} materials for 200 people, ${many} for 1000`).toBe(few)
    expect(many, `${many} hair materials is more than the palette can account for`).toBeLessThan(48)
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

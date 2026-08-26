import type { BodyKind, NpcRole } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildFor, type Build, type CastMember } from '../src/index.ts'
import { BODIES, loadCast, person, wardrobe } from './pack.ts'
import { posed, skinsOf, type Skin } from './posing.ts'

const cast = await loadCast()

/** The band a garment renders in: woven cloth, with the hardware the only thing allowed to shine. */
const FINISH = { roughest: 0.95, smoothest: 0.6 }

/**
 * How far into the bare skin a garment may reach, in metres. The build holds
 * them clear in the rest pose; a clip shears the cloth and the skin under it by
 * a few millimetres more, which is a collar tucked under the neck's bottom
 * edge rather than a neck coming through the cloth.
 */
const THROUGH = 0.006

/** How near the skin a garment vertex has to be before it is worth asking whether it is inside it. */
const OVER = 0.05

/**
 * How far off the body's own brow ridge another pair of eyebrows may sit, in
 * metres. The build holds a worn piece 3 mm outside the skin and the ridge's
 * own normal points up as well as forward, so a pair put on the ridge still
 * comes to rest a little above it.
 */
const ON_THE_RIDGE = 0.003

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

/** The centre of a mesh's own box, where the game has it. */
function centreOf(mesh: THREE.Mesh): THREE.Vector3 {
  return new THREE.Box3()
    .setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute)
    .applyMatrix4(mesh.matrixWorld)
    .getCenter(new THREE.Vector3())
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

/**
 * The bare skin as a closed shape: where its vertices land in the pose, its
 * triangles, a cap over the cut edge the build trimmed it to, and the height
 * that cut reaches. Capped, so "inside the body" is a question with an answer;
 * open, every test against it reads cloth hanging below the neck as buried.
 */
function posedSkin(skin: Skin) {
  const points = Array.from({ length: skin.position.count }, (_, vertex) => posed(skin, vertex))
  const index = skin.mesh.geometry.getIndex()!
  // welded by position: a UV seam splits one vertex in two and would read as a cut
  const at = new Map<string, number>()
  const welded = points.map((point) => {
    const key = point.toArray().map((one) => one.toFixed(5)).join(',')
    if (!at.has(key)) at.set(key, at.size)
    return at.get(key)!
  })
  const tris: Array<[number, number, number]> = []
  const uses = new Map<string, number>()
  for (let corner = 0; corner < index.count; corner += 3) {
    const face: [number, number, number] = [index.getX(corner), index.getX(corner + 1), index.getX(corner + 2)]
    tris.push(face)
    for (const [one, two] of [[face[0], face[1]], [face[1], face[2]], [face[2], face[0]]]) {
      const key = [welded[one!]!, welded[two!]!].sort((x, y) => x - y).join('/')
      uses.set(key, (uses.get(key) ?? 0) + 1)
    }
  }

  const rim: Array<[number, number]> = []
  const onRim = new Set<number>()
  for (const [key, count] of uses) {
    if (count !== 1) continue
    const [one, two] = key.split('/').map(Number)
    rim.push([one!, two!])
    onRim.add(one!).add(two!)
  }
  const first = new Map<number, number>()
  for (let vertex = 0; vertex < points.length; vertex++) if (!first.has(welded[vertex]!)) first.set(welded[vertex]!, vertex)
  const middle = new THREE.Vector3()
  let cut = -Infinity
  for (const one of onRim) {
    const at = points[first.get(one)!]!
    middle.add(at)
    cut = Math.max(cut, at.y)
  }
  middle.divideScalar(onRim.size || 1)
  points.push(middle)
  for (const [one, two] of rim) tris.push([first.get(one)!, first.get(two)!, points.length - 1])

  return { points, tris, cut }
}

/** Whether a point is inside a closed shape: an odd number of its faces stand between it and away. */
function inside({ points, tris }: ReturnType<typeof posedSkin>, point: THREE.Vector3): boolean {
  const away = new THREE.Vector3(0.3145, 0.7231, 0.6147).normalize()
  const edge1 = new THREE.Vector3()
  const edge2 = new THREE.Vector3()
  const across = new THREE.Vector3()
  const to = new THREE.Vector3()
  const up = new THREE.Vector3()
  let crossings = 0
  for (const [a, b, c] of tris) {
    edge1.subVectors(points[b]!, points[a]!)
    edge2.subVectors(points[c]!, points[a]!)
    across.crossVectors(away, edge2)
    const face = edge1.dot(across)
    if (Math.abs(face) < 1e-12) continue
    to.subVectors(point, points[a]!)
    const u = to.dot(across) / face
    if (u < 0 || u > 1) continue
    up.crossVectors(to, edge1)
    const v = away.dot(up) / face
    if (v < 0 || u + v > 1) continue
    if (edge2.dot(up) / face > 1e-9) crossings++
  }
  return crossings % 2 === 1
}

/**
 * How far inside the bare skin the deepest garment vertex sits, in metres, and
 * where. Zero is a garment wholly outside the body, which is what a worn
 * garment is. Cloth that crosses the skin shows as a hole with torn edges: the
 * skin covers the cloth in one triangle and the cloth covers the skin in the
 * next.
 *
 * Only the cloth above the skin's own cut edge is asked about. Below that the
 * build kept no skin, so nothing there can be covered by any.
 */
function throughTheSkin(member: CastMember) {
  member.object.updateMatrixWorld(true)
  const skins = skinsOf(member.object).filter((skin) => skin.mesh.visible)
  const bare = skins.filter((skin) => /^Super/i.test(skin.mesh.name)).map(posedSkin)
  const worn = skins.filter((skin) => !/^(hair|beard|brows|Eyes|Super)/i.test(skin.mesh.name))
  let deepest = 0
  let where: THREE.Vector3 | undefined
  for (const skin of worn) {
    for (let vertex = 0; vertex < skin.position.count; vertex++) {
      const point = posed(skin, vertex)
      for (const body of bare) {
        if (point.y < body.cut) continue
        let best = Infinity
        for (const one of body.points) best = Math.min(best, one.distanceToSquared(point))
        // only the cloth that meets the skin at all: the rest is a sleeve, a boot, a hem
        if (best > OVER * OVER || !inside(body, point)) continue
        const depth = Math.sqrt(best)
        if (depth <= deepest) continue
        deepest = depth
        where = point
      }
    }
  }
  return { deepest, where }
}

/** An id of somebody in this role built this way, or nothing if the role never is. */
function someone(role: NpcRole, build: Build): string | undefined {
  for (let n = 0; n < 400; n++) {
    const id = `npc_${role}_${n}`
    if (buildFor({ id, role }) === build) return id
  }
  return undefined
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

  /**
   * What the owner saw as two pairs of eyebrows on one face: the pack models a
   * pair for each head, and the second shape a person can be given is the other
   * head's. Carried across by the head bone it landed 7 mm off this body's brow
   * ridge and 10 mm out of the plane of its face; settled out of the skin from
   * there it rode up the forehead until its lash row cleared the eye, and the
   * lashes read as a second pair of brows under the first. Every pair a person
   * can be given has to sit on the one brow ridge.
   */
  it('puts every pair of eyebrows on the brow ridge, so nobody wears two', () => {
    for (const entry of wardrobe.characters) {
      const member = cast.spawn(person({ id: `npc_brows_${entry.id}`, appearance: { base: entry.body, variant: 1 } }))
      member.object.updateMatrixWorld(true)
      const eyes = centreOf(meshNamed(member.object, 'Eyes'))
      expect(entry.brows.length, `${entry.id} carries no eyebrows`).toBeGreaterThan(0)
      // the first pair is the body's own, placed by the artist: the ridge
      const ridge = centreOf(meshNamed(member.object, entry.brows[0]!)).y - eyes.y
      for (const piece of entry.brows.slice(1)) {
        const off = centreOf(meshNamed(member.object, piece)).y - eyes.y - ridge
        expect(
          Math.abs(off),
          `${entry.id}: ${piece} sits ${(off * 1000).toFixed(1)} mm off the ridge the body's own pair is on`,
        ).toBeLessThan(ON_THE_RIDGE)
      }
    }
  })

  /**
   * What the owner saw as a coat torn open: the pack's collars are cut for a
   * narrower neck than this body's, so the ranger coat's rim crossed the nape
   * and the neck came through the cloth in ragged holes. Every outfit, on every
   * build the game can put it on, measured in the pose it is spawned in.
   */
  it('closes every collar over the neck, on both builds, so nothing comes through the cloth', () => {
    const seen = new Map<string, number>()
    for (const entry of wardrobe.characters) {
      for (const role of entry.roles) {
        for (const build of ['regular', 'heavy'] as const) {
          const id = someone(role as NpcRole, build)
          if (!id) continue
          const member = cast.spawn(person({ id, role: role as NpcRole, appearance: { base: entry.body, variant: 1 } }))
          cast.update(0.001)
          const { deepest, where } = throughTheSkin(member)
          seen.set(`${member.outfit}/${member.build}`, deepest)
          expect(
            deepest,
            `${member.outfit}/${member.build}: the cloth is ${(deepest * 1000).toFixed(1)} mm inside the bare skin at ` +
              `${where?.toArray().map((one) => one.toFixed(3)).join(', ')}`,
          ).toBeLessThan(THROUGH)
        }
      }
    }
    const outfits = new Set([...seen.keys()].map((key) => key.split('/')[0]))
    expect(outfits.size, `only ${outfits.size} of ${wardrobe.characters.length} outfits were measured`).toBe(wardrobe.characters.length)
    expect([...seen.keys()].some((key) => key.endsWith('/heavy')), 'no heavy build was measured').toBe(true)
  })

  /**
   * What the owner saw as wet patent leather: the garments shipped one flat
   * roughness with a trace of metal in it, so a black coat answered the street
   * with one hard highlight. Cloth is a dielectric, and its roughness comes off
   * this outfit's own weave sheet.
   */
  it('gives every garment a woven finish rather than a coated one', () => {
    for (const entry of wardrobe.characters) {
      const member = cast.spawn(person({ id: `npc_finish_${entry.id}`, appearance: { base: entry.body, variant: 1 } }))
      const garments = new Set<THREE.MeshStandardMaterial>()
      member.object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh || Array.isArray(mesh.material)) return
        if (/^MI_(Peasant|Ranger)$/.test(mesh.material.name)) garments.add(mesh.material as THREE.MeshStandardMaterial)
      })
      expect(garments.size, `${entry.id} renders no garment material`).toBeGreaterThan(0)
      for (const material of garments) {
        expect(material.roughness, `${entry.id}: ${material.name} renders at roughness ${material.roughness}`).toBeGreaterThan(FINISH.smoothest)
        expect(material.roughness, `${entry.id}: ${material.name} renders at roughness ${material.roughness}`).toBeLessThan(FINISH.roughest)
        expect(material.metalness, `${entry.id}: ${material.name} renders with ${material.metalness} of metal in it`).toBe(0)
        expect(material.roughnessMap, `${entry.id}: ${material.name} has no weave to break its highlight up`).toBeTruthy()
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

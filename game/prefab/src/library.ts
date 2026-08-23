import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import type { Catalogue } from './catalogue.ts'
import { prefabMaterial, type PrefabAtlas } from './material.ts'
import { LAYER_ATTRIBUTE } from './pack.ts'

export class LibraryIncomplete extends Error {
  readonly code = 'library-incomplete'
  constructor(readonly missing: readonly string[]) {
    super(`the prefab pack is missing ${missing.length} of the models its manifest names: ${missing.slice(0, 6).join(', ')}`)
    this.name = 'LibraryIncomplete'
  }
}

export interface LibrarySpec {
  readonly catalogue: Catalogue
  /** The pack's scene, or the array `GLTFLoader` hands back. */
  readonly scenes: THREE.Object3D | readonly THREE.Object3D[]
  readonly atlas: PrefabAtlas
  readonly night: CityNight
}

/**
 * The pack, loaded: one geometry per model and the single material they all
 * share. Buildings clone out of here rather than reloading, so a town of
 * hundreds costs one copy of each shape it actually uses.
 */
export class Library {
  readonly catalogue: Catalogue
  readonly material: THREE.Material
  readonly #geometries: ReadonlyMap<string, THREE.BufferGeometry>

  private constructor(catalogue: Catalogue, material: THREE.Material, geometries: Map<string, THREE.BufferGeometry>) {
    this.catalogue = catalogue
    this.material = material
    this.#geometries = geometries
  }

  static of(spec: LibrarySpec): Library {
    const roots = Array.isArray(spec.scenes) ? spec.scenes : [spec.scenes as THREE.Object3D]
    const found = new Map<string, THREE.BufferGeometry>()
    for (const root of roots) {
      root.updateMatrixWorld(true)
      root.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && !found.has(mesh.name)) found.set(mesh.name, prepared(mesh))
      })
    }

    const missing = spec.catalogue.models.filter((model) => !found.has(model.id)).map((model) => model.id)
    if (missing.length) throw new LibraryIncomplete(missing)

    const geometries = new Map(spec.catalogue.models.map((model) => [model.id, found.get(model.id)!]))
    return new Library(spec.catalogue, prefabMaterial(spec.atlas, spec.night), geometries)
  }

  /** The model's own geometry, in its own frame, door on the south wall. */
  geometry(id: string): THREE.BufferGeometry | undefined {
    return this.#geometries.get(id)
  }
}

/**
 * One shape for every geometry in the pack: float position, normal, uv and the
 * layer index, indexed, nothing else. `@gb/scene` only welds two geometries
 * into one buffer when they agree attribute for attribute, so a pack whose
 * models disagree would batch as several.
 *
 * Positions come out in metres. The pack stores them as whole numbers with a
 * scale on the node, which is what makes it 3 MB instead of 13, so the scale is
 * multiplied out once here rather than on every building. It is uniform, so the
 * normals are already pointing the right way.
 */
function prepared(mesh: THREE.Mesh): THREE.BufferGeometry {
  const source = mesh.geometry
  const position = new THREE.Float32BufferAttribute(new Float32Array(source.getAttribute('position').count * 3), 3)
  const point = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(source.getAttribute('position') as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld)
    position.setXYZ(i, point.x, point.y, point.z)
  }

  const normal = source.getAttribute('normal')
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', position)
  out.setAttribute('normal', new THREE.Float32BufferAttribute(unpacked(normal), 3))
  out.setAttribute('uv', source.getAttribute('uv'))
  out.setAttribute(LAYER_ATTRIBUTE, source.getAttribute(LAYER_ATTRIBUTE))
  out.setIndex(source.getIndex())
  return out
}

/** Normals arrive as signed bytes; a batch needs every geometry in one shape. */
function unpacked(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array {
  const out = new Float32Array(attribute.count * 3)
  for (let i = 0; i < attribute.count; i++) {
    out[i * 3] = attribute.getX(i)
    out[i * 3 + 1] = attribute.getY(i)
    out[i * 3 + 2] = attribute.getZ(i)
  }
  return out
}

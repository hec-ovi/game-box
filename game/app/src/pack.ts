import { Cast, CastDressing, parseWardrobe } from '@gb/cast'
import { FurnishDressing, loadFurnish } from '@gb/furnish'
import { KitDressing, loadKit, type CityNight } from '@gb/kitbash'
import { PrefabDressing, loadPrefab, type Catalogue } from '@gb/prefab'
import { Greybox, type Dressing } from '@gb/scene'
import type { Interior, ResolvedCharter } from '@gb/world'
import type * as THREE from 'three'
import { guarded } from './guarded.ts'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

/**
 * An interior's own room: the dressing that paints it and the wall bays to add
 * to what came back. Each interior draws its own floor, walls and ceiling from
 * its id, so the shop is not the same room as the flat above it, and its
 * charter says what each room is used for when the file left that out.
 */
export type RoomArt = (interior: Interior, charter: ResolvedCharter) => { dressing: Dressing; decor: THREE.Object3D }

/** What the art pack answers for, and what is left of it when a piece is missing. */
export interface ArtPack {
  dressing: Dressing
  room?: RoomArt
  cast?: Cast
  kit?: KitDressing
  /**
   * The building pack's own catalogue, when it loaded. A city generated here is
   * pinned to it before it is sealed, so it has to come back out rather than
   * staying inside the dressing that uses it.
   */
  catalogue?: Catalogue
}

/**
 * Loads the shipped art. Dressing is a chain: the cast answers for people, the
 * furniture answers for the inside of a building, the kit answers for the
 * outside, and the greybox answers for whatever is left. Any link that will not
 * load drops out, so a missing download is a duller city rather than a blank
 * screen.
 */
export async function loadDressing(theme: string, base = ''): Promise<ArtPack> {
  const buildings = await loadBuildings(base, theme)
  const kit = buildings?.kit
  const outside = buildings?.front ?? new Greybox()
  const furnish = await loadInteriors(base, outside)
  const cast = await loadPeople(base)
  if (cast) cast.theme = theme

  // the people go outside the furniture in the chain, so a room built for one
  // interior still has the cast answering for whoever is standing in it
  const chain = (inside: Dressing): Dressing => guarded(cast ? new CastDressing(cast, inside) : inside)
  const room: RoomArt | undefined = furnish
    ? (interior, charter) => {
        const dressed = furnish.room(interior, charter)
        return { dressing: chain(dressed.dressing), decor: dressed.decor }
      }
    : undefined

  return {
    dressing: chain(furnish ?? outside),
    ...(room ? { room } : {}),
    ...(cast ? { cast } : {}),
    ...(kit ? { kit } : {}),
    ...(buildings?.catalogue ? { catalogue: buildings.catalogue } : {}),
  }
}

async function loadPeople(base: string): Promise<Cast | undefined> {
  try {
    const wardrobe = parseWardrobe(await (await fetch(`${base}/wardrobe.json`)).json())
    const [anims, ...files] = await Promise.all([
      bytes(`${base}/anims.glb`),
      ...wardrobe.characters.map((entry) => bytes(`${base}/${entry.file}`)),
    ])
    const characters = Object.fromEntries(wardrobe.characters.map((entry, index) => [entry.id, files[index]!]))
    return await Cast.load({ anims: anims!, wardrobe, characters })
  } catch (cause) {
    console.warn(`no people in the art pack (${String(cause)}); the city will be empty`)
    return undefined
  }
}

/** Furniture, floors and walls. Behind it, whatever answers for the outside. */
async function loadInteriors(base: string, behind: Dressing): Promise<FurnishDressing | undefined> {
  try {
    const gltf = await read(`${base}/interior-kit.glb`)
    return new FurnishDressing(loadFurnish(gltf.scenes), behind)
  } catch (cause) {
    console.warn(`no interior kit (${String(cause)}); rooms stay grey`)
    return undefined
  }
}

async function loadBuildings(
  base: string,
  theme: string,
): Promise<{ kit: KitDressing; front: Dressing; catalogue?: Catalogue } | undefined> {
  try {
    const gltf = await read(`${base}/downtown-kit.glb`)
    // the theme is what picks the tone the whole kit is painted in, so a town
    // that is not a neon one has to say so here or it comes out as one
    const library = loadKit(gltf.scenes, theme)
    const kit = new KitDressing(library, new Greybox())
    return { kit, ...(await loadPrefabs(kit, library.night)) }
  } catch (cause) {
    console.warn(`no building kit (${String(cause)}); the city will be blocks`)
    return undefined
  }
}

/** Whole buildings out of the committed pack; the kit answers for any shape it has no model for. */
async function loadPrefabs(kit: KitDressing, night: CityNight): Promise<{ front: Dressing; catalogue?: Catalogue }> {
  try {
    const library = await loadPrefab(night)
    return { front: new PrefabDressing(library, kit), catalogue: library.catalogue }
  } catch (cause) {
    console.warn(`no building pack (${String(cause)}); every plot is kit-built`)
    return { front: kit }
  }
}

/** One compressed glTF from the pack. */
async function read(url: string) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  return loader.parseAsync(await bytes(url), '')
}

async function bytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.arrayBuffer()
}

/** The car models, or nothing: empty roads are better than a broken boot. */
export async function loadCars(base = ''): Promise<ArrayBuffer | undefined> {
  try {
    return await bytes(`${base}/cars.glb`)
  } catch (cause) {
    console.warn(`no cars in the art pack (${String(cause)}); the roads stay empty`)
    return undefined
  }
}

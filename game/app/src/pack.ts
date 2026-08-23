import { Cast, CastDressing, parseWardrobe } from '@gb/cast'
import { FurnishDressing, loadFurnish } from '@gb/furnish'
import { KitDressing, loadKit, type CityNight } from '@gb/kitbash'
import { PrefabDressing, loadPrefab } from '@gb/prefab'
import { Greybox, type Dressing } from '@gb/scene'
import { guarded } from './guarded.ts'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

/**
 * Loads the shipped art. Dressing is a chain: the cast answers for people, the
 * kit answers for buildings, and the greybox answers for whatever is left. Any
 * link that will not load drops out, so a missing download is a duller city
 * rather than a blank screen.
 */
export async function loadDressing(
  theme: string,
  base = '',
): Promise<{ dressing: Dressing; cast?: Cast; kit?: KitDressing }> {
  const buildings = await loadBuildings(base, theme)
  const kit = buildings?.kit
  const behind = await loadInteriors(base, buildings?.front ?? new Greybox())
  const cast = await loadPeople(base)
  if (!cast) return { dressing: guarded(behind), ...(kit ? { kit } : {}) }

  cast.theme = theme
  return { dressing: guarded(new CastDressing(cast, behind)), cast, ...(kit ? { kit } : {}) }
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
async function loadInteriors(base: string, behind: Dressing): Promise<Dressing> {
  try {
    const gltf = await read(`${base}/interior-kit.glb`)
    return new FurnishDressing(loadFurnish(gltf.scenes), behind)
  } catch (cause) {
    console.warn(`no interior kit (${String(cause)}); rooms stay grey`)
    return behind
  }
}

async function loadBuildings(base: string, theme: string): Promise<{ kit: KitDressing; front: Dressing } | undefined> {
  try {
    const gltf = await read(`${base}/downtown-kit.glb`)
    // the theme is what picks the tone the whole kit is painted in, so a town
    // that is not a neon one has to say so here or it comes out as one
    const library = loadKit(gltf.scenes, theme)
    const kit = new KitDressing(library, new Greybox())
    return { kit, front: await loadPrefabs(kit, library.night) }
  } catch (cause) {
    console.warn(`no building kit (${String(cause)}); the city will be blocks`)
    return undefined
  }
}

/** Whole buildings out of the committed pack; the kit answers for any shape it has no model for. */
async function loadPrefabs(kit: KitDressing, night: CityNight): Promise<Dressing> {
  try {
    return new PrefabDressing(await loadPrefab(night), kit)
  } catch (cause) {
    console.warn(`no building pack (${String(cause)}); every plot is kit-built`)
    return kit
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

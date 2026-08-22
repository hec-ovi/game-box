import { Cast, CastDressing, parseWardrobe } from '@gb/cast'
import { KitDressing, loadKit } from '@gb/kitbash'
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
export async function loadDressing(theme: string, base = ''): Promise<{ dressing: Dressing; cast?: Cast }> {
  const behind = (await loadBuildings(base)) ?? new Greybox()
  const cast = await loadPeople(base)
  if (!cast) return { dressing: guarded(behind) }

  cast.theme = theme
  return { dressing: guarded(new CastDressing(cast, behind)), cast }
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

async function loadBuildings(base: string): Promise<Dressing | undefined> {
  try {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const gltf = await loader.parseAsync(await bytes(`${base}/downtown-kit.glb`), '')
    return new KitDressing(loadKit(gltf.scenes), new Greybox())
  } catch (cause) {
    console.warn(`no building kit (${String(cause)}); the city will be blocks`)
    return undefined
  }
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

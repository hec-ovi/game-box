import { Cast, CastDressing } from '@gb/cast'
import { Greybox, type Dressing } from '@gb/scene'

/**
 * Loads the shipped asset pack. If it is not there, the game still runs on
 * boxes, so a missing download is a duller city rather than a blank screen.
 */
export async function loadDressing(base = ''): Promise<{ dressing: Dressing; cast?: Cast }> {
  try {
    const outfitNames = ['Male_Peasant', 'Female_Peasant', 'Male_Ranger', 'Female_Ranger']
    const [anims, male, female, ...worn] = await Promise.all([
      bytes(`${base}/anims.glb`),
      bytes(`${base}/bodies/Superhero_Male_FullBody.glb`),
      bytes(`${base}/bodies/Superhero_Female_FullBody.glb`),
      ...outfitNames.map((name) => bytes(`${base}/outfits/${name}.glb`)),
    ])
    const outfits = Object.fromEntries(outfitNames.map((name, index) => [name, worn[index]!]))
    const cast = await Cast.load({ anims, bodies: { male, female }, outfits })
    return { dressing: new CastDressing(cast), cast }
  } catch (cause) {
    console.warn(`no asset pack (${String(cause)}); running on boxes`)
    return { dressing: new Greybox() }
  }
}

async function bytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.arrayBuffer()
}

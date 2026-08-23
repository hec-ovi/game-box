import { OutfitAtlas } from './atlas.mjs'
import { knownFabrics } from './fabrics.mjs'
import { Repaint } from './repaint.mjs'

/** How wide the repainted sheets are. The rest of the build works at this size. */
const SIZE = 1024

/**
 * Repaints one outfit's garments off the sheets the pack ships.
 *
 * The pack is fantasy: forest green cloth, tan leather harness, metal studs.
 * Every part is fed in here before it is worn, its own pixels of the shared
 * sheet are found, and each fabric is given a colour a city would wear. Parts
 * of one family share the outfit's single repainted sheet, so a character with
 * four ranger garments still carries one texture.
 *
 * A fabric marked to glow is painted into a second sheet as well, black
 * everywhere else, which the material emits from: that is the one lit accent
 * each person carries.
 */
export class GarmentPainter {
  #palette
  #families = new Map()

  constructor(palette) {
    this.#palette = palette
  }

  /**
   * Notes one garment: which pixels it uses and what colour each fabric
   * becomes. `part.drop` names nodes that are not worn at all, so the belts and
   * bracers do not get a say in the mask either.
   */
  async add(document, part) {
    const dropped = new Set(part.drop ?? [])
    const masks = new Map()
    for (const node of document.getRoot().listNodes()) {
      const mesh = node.getMesh()
      if (!mesh || dropped.has(node.getName())) continue
      for (const primitive of mesh.listPrimitives()) {
        const material = primitive.getMaterial()
        const family = familyOf(material)
        if (!family) continue
        const sheet = await this.#sheet(family, material, part)
        let mask = masks.get(family)
        if (!mask) {
          mask = sheet.atlas.mask()
          masks.set(family, mask)
          sheet.jobs.push({ part: part.name, mask, repaint: this.#repaint(family, part) })
        }
        mask.add(primitive)
      }
    }
  }

  /**
   * Every family's finished sheet, as PNG bytes. Garments are painted in the
   * order they were added, so where two of them claim the same few pixels of a
   * shared island the one worn on top has the last word.
   */
  async finish() {
    const sheets = new Map()
    for (const [family, sheet] of this.#families) {
      const changed = new Map()
      for (const job of sheet.jobs) {
        for (const [fabric, count] of sheet.atlas.paint(job.mask, job.repaint)) {
          changed.set(fabric, (changed.get(fabric) ?? 0) + count)
        }
      }
      sheets.set(family, { png: await sheet.atlas.toPng(), glow: await sheet.atlas.toGlowPng(), changed })
    }
    return sheets
  }

  #repaint(family, part) {
    const recipe = Object.fromEntries(
      Object.entries(part.paint ?? {}).map(([fabric, spec]) => [fabric, this.#palette.rule(spec)]),
    )
    const repaint = new Repaint(family, recipe)
    const missing = repaint.missing()
    if (missing.length) throw new Error(`${part.name}: nothing said what the ${missing.join(' and ')} becomes`)
    return repaint
  }

  async #sheet(family, material, part) {
    const ready = this.#families.get(family)
    if (ready) return ready
    const texture = material.getBaseColorTexture()
    if (!texture) throw new Error(`${part.name}: ${material.getName()} has no base colour texture to repaint`)
    const sheet = { atlas: await OutfitAtlas.load(Buffer.from(texture.getImage()), SIZE), jobs: [] }
    this.#families.set(family, sheet)
    return sheet
  }
}

/**
 * Which source family a material belongs to, or nothing if it is not a garment.
 * The pack names its materials after the sheet they draw from (`MI_Ranger`),
 * and the skin materials (`MI_Regular_Male`) are not sheets we repaint.
 */
function familyOf(material) {
  const name = material?.getName()?.replace(/^MI_/, '')
  return name && knownFabrics(name) ? name : undefined
}

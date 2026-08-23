/**
 * What the source atlases are made of.
 *
 * Both packs paint several materials into one texture: the peasant sheet is
 * linen and dark leather, the ranger sheet is green cloth, tan leather and the
 * pale metal of its studs and buckles. A repaint has to tell them apart before
 * it can give each one a new colour, so each family is a short ordered list of
 * tests over hue, saturation and value; the first that matches wins and the
 * last one catches everything left.
 *
 * Each fabric also carries how much settling it wants by default, 0 to 1: how
 * far its own light and shade is pulled towards one even tone. Cloth keeps
 * nearly all of it, because that shading is what makes it look like cloth.
 * Studs lose nearly all of it, which is how a painted-on buckle disappears
 * into the garment around it.
 */

/** Hue in degrees, saturation and value both 0 to 1. */
function hsv(r, g, b) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const range = high - low
  let hue = 0
  if (range) {
    if (high === red) hue = ((green - blue) / range + 6) % 6
    else if (high === green) hue = (blue - red) / range + 2
    else hue = (red - green) / range + 4
    hue *= 60
  }
  return [hue, high ? range / high : 0, high]
}

/** Perceived brightness, 0 to 1. */
export function luminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const FAMILIES = {
  // Linen shirts and sleeves against everything darker and browner. There is
  // no metal on this sheet, and a stud rule here would eat the lit side of a
  // linen shirt, which is pale enough to pass any test for one. The linen is
  // painted with grime, so it settles hard: left alone a white shirt comes out
  // blotched.
  Peasant: [
    { name: 'linen', is: (h, s, v) => s < 0.4 && v > 0.3, settle: 0.65 },
    { name: 'leather', is: () => true, settle: 0.32 },
  ],
  // The pale grey-green of the studs first, then cloth by hue, then the straps
  // and harness. The straps settle halfway: enough to stop reading as a strap,
  // little enough to leave a seam where one was.
  Ranger: [
    { name: 'stud', is: (h, s, v) => s < 0.18 && v > 0.4, settle: 0.88 },
    { name: 'cloth', is: (h) => h >= 55 && h <= 175, settle: 0.12 },
    { name: 'leather', is: () => true, settle: 0.55 },
  ],
}

/** Whether a source sheet by this name is one the repaint knows how to read. */
export function knownFabrics(family) {
  return Boolean(FAMILIES[family])
}

/** The fabrics one source atlas is painted with, and which one a pixel is. */
export class FabricSet {
  #rules

  constructor(family) {
    const rules = FAMILIES[family]
    if (!rules) throw new Error(`no fabric rules for ${family}; known: ${Object.keys(FAMILIES).join(', ')}`)
    this.#rules = rules
  }

  /** Every fabric name this family can report, in the order they are tested. */
  get names() {
    return this.#rules.map((rule) => rule.name)
  }

  /** How much this fabric settles when an outfit does not say. */
  settle(name) {
    return this.#rules.find((rule) => rule.name === name)?.settle ?? 0
  }

  classify(r, g, b) {
    const [hue, saturation, value] = hsv(r, g, b)
    for (const rule of this.#rules) if (rule.is(hue, saturation, value)) return rule.name
    return this.#rules.at(-1).name
  }
}

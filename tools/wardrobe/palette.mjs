/**
 * The colours the wardrobe paints with, by name.
 *
 * Outfits name a colour ("navy", "amber") rather than carrying a hex code, so
 * the manifest reads as clothes and one edit here restyles everybody wearing
 * that colour.
 */
export class Palette {
  #colours

  constructor(fabrics) {
    this.#colours = new Map(Object.entries(fabrics).map(([name, hex]) => [name, rgb(name, hex)]))
  }

  /**
   * Turns what an outfit wrote into what `Repaint` wants. A rule is a colour
   * name on its own, or an object: `flatten` when the garment wants more or
   * less settling than the source fabric asks for by default, and `glow` when
   * the fabric is the one accent on the person that gives off light.
   */
  rule(spec) {
    const named = typeof spec === 'string' ? { colour: spec } : spec
    const colour = this.#colours.get(named.colour)
    if (!colour) throw new Error(`no fabric called ${named.colour}; known: ${[...this.#colours.keys()].join(', ')}`)
    return {
      colour,
      ...(named.flatten === undefined ? {} : { flatten: named.flatten }),
      ...(named.glow ? { glow: named.glow } : {}),
    }
  }
}

function rgb(name, hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`fabric ${name} is ${hex}, which is not a #rrggbb colour`)
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** A colour the stylesheet declared: packed `0xRRGGBB`, and how much of it shows. */
export interface Tone {
  readonly colour: number
  readonly alpha: number
}

/** The tones a drawing asked for, by the name of the custom property each came from. */
export type Palette<Token extends string> = Readonly<Record<Token, Tone>>

/**
 * A surface's own palette, read off the element the city is drawn in.
 *
 * A renderer needs numbers where the stylesheet has words, and this is the one
 * place the two meet: every drawing asks for the tokens it paints with by name,
 * so retinting a surface retints the city drawn on it. The front door and the
 * interface declare their own, so the same drawing comes out in whichever it
 * is standing in.
 */
export function paletteOf<const Tokens extends readonly string[]>(
  element: HTMLElement,
  tokens: Tokens,
): Palette<Tokens[number]> {
  const style = getComputedStyle(element)
  const read = {} as Record<string, Tone>
  for (const token of tokens) {
    const tone = parse(style.getPropertyValue(token).trim())
    if (!tone) throw new Error(`the blueprint has no ${token} to draw with`)
    read[token] = tone
  }
  return read as Palette<Tokens[number]>
}

const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i
const RGB = /^rgba?\(([^)]+)\)$/i

function parse(value: string): Tone | undefined {
  const hex = HEX.exec(value)
  if (hex) {
    const digits = hex[1]!
    const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits
    return { colour: Number.parseInt(full, 16), alpha: 1 }
  }
  const rgb = RGB.exec(value)
  if (!rgb) return undefined
  const parts = rgb[1]!.split(/[,/]/).map((part) => Number.parseFloat(part))
  const [red, green, blue, alpha] = parts
  if (red === undefined || green === undefined || blue === undefined || parts.slice(0, 3).some(Number.isNaN)) return undefined
  return { colour: (round(red) << 16) | (round(green) << 8) | round(blue), alpha: alpha === undefined || Number.isNaN(alpha) ? 1 : alpha }
}

function round(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel)))
}

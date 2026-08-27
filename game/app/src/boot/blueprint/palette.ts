/** A colour the stylesheet declared: packed `0xRRGGBB`, and how much of it shows. */
export interface Tone {
  readonly colour: number
  readonly alpha: number
}

/** Every custom property the blueprint draws with. Nothing here picks a colour; they all come off `.gb-boot`. */
const TOKENS = [
  '--gb-well',
  '--gb-lift',
  '--gb-edge',
  '--gb-edge-lit',
  '--gb-accent',
  '--gb-accent-lit',
  '--gb-accent-dim',
  '--gb-accent-glow',
  '--gb-ink',
] as const

export type Token = (typeof TOKENS)[number]
export type Palette = Readonly<Record<Token, Tone>>

/**
 * The panel's own palette, read off the element the blueprint is drawn in.
 *
 * A renderer needs numbers where the stylesheet has words, and this is the one
 * place the two meet: everything the view paints asks for a token by name, so
 * retinting the panel retints the blueprint with it.
 */
export function paletteOf(element: HTMLElement): Palette {
  const style = getComputedStyle(element)
  const read = {} as Record<Token, Tone>
  for (const token of TOKENS) {
    const tone = parse(style.getPropertyValue(token).trim())
    if (!tone) throw new Error(`the blueprint has no ${token} to draw with`)
    read[token] = tone
  }
  return read
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

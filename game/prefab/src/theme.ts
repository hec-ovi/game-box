import { contract, type SchemaViolation } from '@gb/kit'
import { z } from 'zod'
import type { Bank, Banks, GlazingStrip } from './rooms.ts'

/**
 * A theme pack: the pictures a city's windows and screens show, declared in
 * one file so nothing in the code names an image.
 *
 * A pack is a folder. `theme.json` says what each image is and which kind of
 * window may use it; the images sit in `windows/`, `rooms/`, `faces/` and
 * `ads/` beside it. Drop in your own, name them here, and the build reads them.
 * An image a pack declares but does not carry falls back to the one that ships
 * under the same name, so a half finished pack still builds a city.
 *
 * The manifest is checked here and nowhere else. A pack that is not one is
 * refused with the fields that failed rather than half applied.
 */

/** A file inside the pack's own folders: a plain name, no path, no traversal. */
const FILE = /^[a-z0-9][a-z0-9-]{0,47}\.png$/

/** A pack's own name, which is what a world file records it as. */
const NAME = /^[a-z][a-z0-9-]{0,23}$/

/**
 * The two kinds of window a picture can be meant for: one on the pavement that
 * a player stands a metre from, and one on a floor above the street.
 */
export const WHERE = ['upper', 'street'] as const
export type Where = (typeof WHERE)[number]

const file = z.string().regex(FILE)

const PictureSchema = z.object({
  file,
  /** Which kinds of window may show this picture. One picture may serve both. */
  where: z.array(z.enum(WHERE)).min(1),
})

export const ThemeSchema = z
  .object({
    theme: z.string().regex(NAME),
    version: z.string().min(1),
    /** Flat panels: what a window with no room behind it shows. */
    windows: z.array(PictureSchema).min(1),
    /** Back walls, one per kind of room: the only place detail belongs. */
    rooms: z.array(PictureSchema).min(1),
    /** The four faces every marched room shares, authored flat. */
    faces: z.object({ floor: file, ceiling: file, side: file, sideAlt: file }),
    /** Artwork for the lit screens on the sides of buildings. The screen itself is drawn by the shader. */
    ads: z.array(file).min(1),
  })
  .superRefine((theme, ctx) => {
    for (const [field, pictures] of [
      ['windows', theme.windows],
      ['rooms', theme.rooms],
    ] as const) {
      for (const where of WHERE) {
        if (!pictures.some((picture) => picture.where.includes(where))) {
          ctx.addIssue({ code: 'custom', path: [field], message: `nothing here is for a ${where} window` })
        }
      }
    }
    for (const [field, names] of [
      ['windows', theme.windows.map((picture) => picture.file)],
      ['rooms', theme.rooms.map((picture) => picture.file)],
      ['ads', theme.ads],
    ] as const) {
      const twice = names.filter((name, at) => names.indexOf(name) !== at)
      if (twice.length) ctx.addIssue({ code: 'custom', path: [field], message: `listed twice: ${[...new Set(twice)].join(', ')}` })
    }
  })

export type ThemeDoc = z.infer<typeof ThemeSchema>
export type ThemeImage = ThemeDoc['windows'][number]

export const themeContract = contract('prefab-theme', ThemeSchema)

export class InvalidTheme extends Error {
  readonly code = 'invalid-theme'
  readonly violations: readonly SchemaViolation[]

  constructor(violations: readonly SchemaViolation[]) {
    super(`theme pack rejected: ${violations.map((v) => `${v.path} ${v.message}`).join('; ')}`)
    this.name = 'InvalidTheme'
    this.violations = violations
  }
}

/** Reads a `theme.json`. Anything that is not one comes back as a violation list. */
export function readTheme(value: unknown): ThemeDoc {
  const parsed = themeContract.parse(value)
  if (!parsed.ok) throw new InvalidTheme(parsed.error)
  return parsed.value
}

/** Which folder of the pack a layer's picture comes from. */
export type Folder = 'rooms' | 'windows' | 'faces'

/** One layer of the glazing strip: where its picture is, and what it is for. */
export interface Layer {
  readonly folder: Folder
  readonly file: string
}

/** The glazing strip a theme lays out: every layer in order, and the runs the runtime reads them by. */
export interface StripPlan {
  readonly layers: readonly Layer[]
  readonly strip: GlazingStrip
}

/**
 * How a theme's pictures are stacked into one array texture.
 *
 * Back walls first, then flat panels, then the four shared faces. Inside each
 * of the first two, the pictures for upper windows come first, the ones both
 * kinds may show next, and the ones only a shop window may show last, so each
 * kind of window reads a single run and a picture that serves both is stored
 * once. The two runs overlap where they share pictures, which is the whole
 * point of ordering them this way.
 */
export function planStrip(theme: ThemeDoc): StripPlan {
  const rooms = banked(theme.rooms)
  const panels = banked(theme.windows)
  const faces = [theme.faces.floor, theme.faces.ceiling, theme.faces.side, theme.faces.sideAlt]
  const at = rooms.files.length + panels.files.length

  return {
    layers: [
      ...rooms.files.map((file): Layer => ({ folder: 'rooms', file })),
      ...panels.files.map((file): Layer => ({ folder: 'windows', file })),
      ...faces.map((file): Layer => ({ folder: 'faces', file })),
    ],
    strip: {
      rooms: shifted(rooms.banks, 0),
      panels: shifted(panels.banks, rooms.files.length),
      faces: { floor: at, ceiling: at + 1, side: at + 2, sideAlt: at + 3 },
    },
  }
}

/** One list of pictures, ordered so each kind of window reads one run of it. */
function banked(pictures: readonly ThemeImage[]): { files: readonly string[]; banks: Banks } {
  const only = (where: Where) => pictures.filter((picture) => picture.where.length === 1 && picture.where[0] === where)
  const both = pictures.filter((picture) => picture.where.length > 1)
  const upper = only('upper')
  const street = only('street')
  return {
    files: [...upper, ...both, ...street].map((picture) => picture.file),
    banks: {
      upper: { first: 0, count: upper.length + both.length },
      street: { first: upper.length, count: both.length + street.length },
    },
  }
}

function shifted(banks: Banks, by: number): Banks {
  const move = (bank: Bank): Bank => ({ first: bank.first + by, count: bank.count })
  return { upper: move(banks.upper), street: move(banks.street) }
}

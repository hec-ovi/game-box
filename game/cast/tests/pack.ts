import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Npc } from '@gb/world'
import { Cast, parseWardrobe, type Wardrobe } from '../src/index.ts'

const DIST = join(import.meta.dirname, '..', '..', '..', 'assets', 'dist')

// three reaches for browser globals while decoding textures; the geometry and
// the clips do not need them
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

function read(path: string): ArrayBuffer {
  const bytes = readFileSync(path)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export const wardrobe: Wardrobe = parseWardrobe(JSON.parse(readFileSync(join(DIST, 'wardrobe.json'), 'utf8')))

export function animsBytes(): ArrayBuffer {
  return read(join(DIST, 'anims.glb'))
}

/** The shipped pack, loaded the way the game loads it. */
export async function loadCast(): Promise<Cast> {
  return Cast.load({
    anims: animsBytes(),
    wardrobe,
    characters: Object.fromEntries(wardrobe.characters.map((entry) => [entry.id, read(join(DIST, entry.file))])),
  })
}

export function person(overrides: Partial<Npc> = {}): Npc {
  return {
    id: 'npc_0001',
    name: 'Mara Cole',
    role: 'bartender',
    appearance: { base: 'female', variant: 3 },
    personality: 'Dry, unhurried.',
    knowledge: ['The tide takes the low road twice a day.'],
    ...overrides,
  } as Npc
}

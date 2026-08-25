/**
 * The axes a charter is written on. Every value names a routine the engine
 * ships or a thing on disk, which is what keeps a place a generator invents
 * buildable: a model picks from these and never writes a metre, a piece or a
 * prop of its own.
 */

/** Which dressing routine fills a room. One value per routine that exists. */
export const ROOM_USES = [
  'entrance-hall',
  'waiting-room',
  'lobby',
  'concourse',
  'taproom',
  'cafe-floor',
  'dining-room',
  'shop-floor',
  'market-hall',
  'desk-floor',
  'private-office',
  'bench-floor',
  'ward',
  'assembly',
  'living-room',
  'bedroom',
  'guest-room',
  'kitchen',
  'washroom',
  'store',
  'bulk-store',
] as const

/** What the street face is built of. `blank` is a windowless brick wall. */
export const FRONTAGES = ['masonry', 'painted', 'shopfront', 'curtain', 'industrial', 'blank'] as const

/** How often a window comes round on the upper floors: every module, every second, every third. */
export const OPENNESS = ['dense', 'even', 'sparse'] as const

/** What the building reads as made of, for the art that picks by it. */
export const MATERIALS = ['masonry', 'metal', 'mixed'] as const

/** How loudly the place signs itself. */
export const SIGN_VOICES = ['quiet', 'sober', 'trade', 'loud'] as const

/** Who may go past the front door: everyone, the front room only, or nobody without a key. */
export const ACCESS_KINDS = ['open', 'admitted', 'private'] as const

/** The post at the front, when there is one. */
export const SERVICES = ['none', 'counter', 'desk', 'stalls'] as const

/** What people do in here, beyond the post at the front. */
export const WORK_KINDS = ['desk', 'bench', 'cook', 'floor', 'watch'] as const

/** What the place keeps lying about, as classes of thing. */
export const HOLDINGS = ['goods', 'food', 'drink', 'papers', 'tools', 'valuables', 'medicine', 'personal'] as const

/** The furnishing language the rooms are dressed in. */
export const FINISHES = ['domestic', 'civic', 'industrial', 'corporate', 'worn'] as const

/** How the place stands out on a map. */
export const PROMINENCES = ['background', 'notable', 'landmark'] as const

/** What its entrance is for travel: a subway station is where fast travel boards. */
export const TRANSITS = ['none', 'subway'] as const

/** How much of a plot the building wants. */
export const SPRAWLS = ['narrow', 'wide', 'block'] as const

export type RoomUse = (typeof ROOM_USES)[number]
export type Frontage = (typeof FRONTAGES)[number]
export type Openness = (typeof OPENNESS)[number]
export type Material = (typeof MATERIALS)[number]
export type SignVoice = (typeof SIGN_VOICES)[number]
export type AccessKind = (typeof ACCESS_KINDS)[number]
export type Service = (typeof SERVICES)[number]
export type WorkKind = (typeof WORK_KINDS)[number]
export type Holding = (typeof HOLDINGS)[number]
export type Finish = (typeof FINISHES)[number]
export type Prominence = (typeof PROMINENCES)[number]
export type Sprawl = (typeof SPRAWLS)[number]
export type Transit = (typeof TRANSITS)[number]

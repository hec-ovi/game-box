/**
 * The closed vocabularies. Every generator, including a language model, must
 * pick from these lists, which is what keeps generated content buildable: each
 * value maps to something the game can actually render, animate or place.
 */

export const BUILDING_KINDS = [
  'house',
  'apartment',
  'bar',
  'cafe',
  'restaurant',
  'shop',
  'market',
  'office',
  'workshop',
  'warehouse',
  'clinic',
  'hotel',
  'station',
  'chapel',
] as const

export const ROOM_KINDS = [
  'main',
  'bedroom',
  'kitchen',
  'bathroom',
  'storage',
  'office',
  'hall',
  'cellar',
  'backroom',
] as const

/**
 * A place an NPC can stand and do something. Each kind names the animation set
 * the NPC plays there, so placing an NPC on an anchor is all it takes to make
 * them look busy.
 */
export const ANCHOR_KINDS = [
  'stand',
  'sit',
  'sit-drink',
  'serve',
  'cook',
  /** Sat at a desk, in the chair drawn up to it. */
  'work-desk',
  /** On their feet at a bench, hands on the top. */
  'work-bench',
  'sleep',
  'browse',
  'lean',
  'guard',
] as const

export const NPC_ROLES = [
  'bartender',
  'patron',
  'clerk',
  'resident',
  'worker',
  'vendor',
  'cook',
  'receptionist',
  'mechanic',
  'courier',
  'guard',
  'wanderer',
] as const

/** Physical shapes we can put in the world. A generated item must be one of these. */
export const ITEM_ARCHETYPES = [
  'bottle',
  'glass',
  'crate',
  'box',
  'parcel',
  'book',
  'ledger',
  'envelope',
  'key',
  'keycard',
  'bag',
  'briefcase',
  'toolbox',
  'wrench',
  'painting',
  'statue',
  'phone',
  'radio',
  'plate',
  'cup',
  'cash',
  'gem',
  'flower',
  'medkit',
  'fuelcan',
] as const

export const FURNITURE_PROPS = [
  'bar-counter',
  'bar-stool',
  'table',
  'chair',
  'sofa',
  'bed',
  'desk',
  'office-chair',
  'shelf',
  'cabinet',
  'wardrobe',
  'fridge',
  'stove',
  'sink',
  'counter',
  'register',
  'display-case',
  'crate-stack',
  'plant',
  'lamp',
  'rug',
  'tv',
  'coffee-machine',
  'jukebox',
] as const

/** The bodies an NPC can be built on. Every value must be a body the cast ships. */
export const BODY_KINDS = ['male', 'female'] as const

export const FACINGS = ['north', 'east', 'south', 'west'] as const

/**
 * The classes of road a city is laid with. Each one is a different width, in
 * `METRICS.road`: a street is the ordinary one, an avenue is the spine the
 * streets hang off, and an exit is the road that leaves the valley.
 */
export const ROAD_KINDS = ['street', 'avenue', 'exit'] as const

export type BuildingKind = (typeof BUILDING_KINDS)[number]
export type RoomKind = (typeof ROOM_KINDS)[number]
export type AnchorKind = (typeof ANCHOR_KINDS)[number]
export type NpcRole = (typeof NPC_ROLES)[number]
export type ItemArchetype = (typeof ITEM_ARCHETYPES)[number]
export type FurnitureProp = (typeof FURNITURE_PROPS)[number]
export type BodyKind = (typeof BODY_KINDS)[number]
export type Facing = (typeof FACINGS)[number]
export type RoadKind = (typeof ROAD_KINDS)[number]

/** Which building kinds a player can walk into. */
export const ENTERABLE_KINDS: readonly BuildingKind[] = [
  'house',
  'apartment',
  'bar',
  'cafe',
  'restaurant',
  'shop',
  'market',
  'office',
  'workshop',
  'clinic',
  'hotel',
  'station',
  'chapel',
]

import type { Flavour } from './flavour.ts'

/** The words a town is named from: its people, its signs and its own name. */
export interface Words {
  readonly first: readonly string[]
  readonly last: readonly string[]
  readonly adjectives: readonly string[]
  readonly nouns: readonly string[]
  readonly cityHeads: readonly string[]
  readonly cityTails: readonly string[]
}

/** Names any town can hold, whatever it is built on. */
const CORE_FIRST: readonly string[] = [
  'Mara', 'Hollis', 'Juno', 'Sable', 'Cass', 'Ivo', 'Delia', 'Rook', 'Neve', 'Tam', 'Orla', 'Bez', 'Wren', 'Odis',
  'Anwen', 'Bram', 'Cleo', 'Dov', 'Esme', 'Ferran', 'Greta', 'Hark', 'Imri', 'Jarl', 'Kesia', 'Lorne', 'Mirek',
  'Nadia', 'Osric', 'Pell', 'Quint', 'Rhea', 'Silas', 'Tova', 'Ulla', 'Vidal', 'Wynn', 'Xanthe', 'Yara', 'Zeb',
  'Alma', 'Boaz', 'Carys', 'Doria', 'Eno', 'Fenn', 'Gil', 'Hana', 'Isolde', 'Joss', 'Kit', 'Linus', 'Moss',
]
const CORE_LAST: readonly string[] = [
  'Cole', 'Vance', 'Marek', 'Dunn', 'Ashby', 'Quill', 'Ferro', 'Stroud', 'Lange', 'Reyes', 'Kade', 'Orso',
  'Balint', 'Cray', 'Delph', 'Eastwood', 'Fane', 'Gaunt', 'Hedge', 'Ilves', 'Jerrold', 'Kosta', 'Lomax',
  'Mott', 'Nery', 'Oakes', 'Pallas', 'Rask', 'Sellers', 'Tarn', 'Ubald', 'Vesper', 'Warrick', 'Yates', 'Zorn',
  'Braid', 'Cobb', 'Dray', 'Endicott', 'Fallow',
]

/** What each flavour adds on top: the names, signs and place words it alone uses. */
const EXTRA: Record<Flavour, Partial<Words>> = {
  frontier: {
    first: ['Cyrus', 'Etta', 'Hollow', 'Josiah', 'Lettie', 'Marlow', 'Nell', 'Ruben', 'Tullis', 'Winnie', 'Abner', 'Clemmie'],
    last: ['Beckwith', 'Cardew', 'Hollis', 'Mercer', 'Pike', 'Renfrew', 'Sudden', 'Whitlock', 'Yarrow'],
    adjectives: ['Rusty', 'Dry', 'Last', 'Broken', 'Copper', 'Lonesome', 'Sunken'],
    nouns: ['Spur', 'Nail', 'Claim', 'Shaft', 'Mule', 'Trough', 'Rattler'],
    cityHeads: ['Dry', 'Red', 'Copper', 'Bitter', 'Lost'],
    cityTails: ['Gulch', 'Flats', 'Claim', 'Junction', 'Crossing', 'Wells'],
  },
  coastal: {
    first: ['Maren', 'Sten', 'Coral', 'Fisk', 'Nerissa', 'Perrin', 'Salla', 'Torin', 'Vela', 'Yann'],
    last: ['Brine', 'Halloran', 'Kelp', 'Marlin', 'Netter', 'Sorrel', 'Tidewell', 'Wrack'],
    adjectives: ['Salt', 'Grey', 'Drowned', 'Low', 'Open', 'Foggy'],
    nouns: ['Anchor', 'Gull', 'Net', 'Buoy', 'Lantern', 'Mooring', 'Shell'],
    cityHeads: ['Port', 'North', 'Salt', 'Long', 'Old'],
    cityTails: ['Harbour', 'Reach', 'Sound', 'Landing', 'Point', 'Quay'],
  },
  industrial: {
    first: ['Otto', 'Franka', 'Milos', 'Dagny', 'Grigor', 'Petra', 'Stig', 'Vera', 'Radek'],
    last: ['Kessler', 'Brandt', 'Novak', 'Slag', 'Vogel', 'Werner', 'Zeman', 'Hammel'],
    adjectives: ['Iron', 'Grey', 'Second', 'Cold', 'Black', 'Idle'],
    nouns: ['Wheel', 'Furnace', 'Rivet', 'Siding', 'Boiler', 'Gantry', 'Bell'],
    cityHeads: ['New', 'Lower', 'Iron', 'East'],
    cityTails: ['Works', 'Yard', 'Sidings', 'Foundry', 'Bend', 'Row'],
  },
  neon: {
    first: ['Ayo', 'Kiro', 'Nyx', 'Sena', 'Tobias', 'Vidya', 'Zhen', 'Lian', 'Emre', 'Priya'],
    last: ['Achebe', 'Bhatt', 'Cheung', 'Dagher', 'Ferreira', 'Ito', 'Okoro', 'Sandoval', 'Vasquez'],
    adjectives: ['Static', 'Violet', 'Chrome', 'Nine', 'Late', 'Silent'],
    nouns: ['Circuit', 'Halo', 'Signal', 'Filament', 'Orbit', 'Pulse', 'Kiosk'],
    cityHeads: ['New', 'Upper', 'Neo', 'Grand'],
    cityTails: ['Terminal', 'Sector', 'Heights', 'Interchange', 'Basin', 'Span'],
  },
  alpine: {
    first: ['Anneke', 'Bertil', 'Gunda', 'Halvor', 'Ingrid', 'Karsten', 'Liesl', 'Nils', 'Runa'],
    last: ['Aldern', 'Berg', 'Fjell', 'Holt', 'Kvist', 'Lund', 'Steiner', 'Vogt'],
    adjectives: ['White', 'High', 'Frozen', 'Old', 'Still', 'Pine'],
    nouns: ['Kettle', 'Lantern', 'Bell', 'Hearth', 'Antler', 'Sled', 'Peak'],
    cityHeads: ['Upper', 'High', 'Little', 'Cold'],
    cityTails: ['Hollow', 'Pass', 'Vale', 'Ridge', 'Fell', 'Rest'],
  },
  agrarian: {
    first: ['Bess', 'Cormac', 'Dilys', 'Ewan', 'Ffion', 'Hal', 'Maud', 'Roland', 'Tegan'],
    last: ['Barleigh', 'Cropper', 'Furrow', 'Haywood', 'Milner', 'Peasgood', 'Thresher', 'Wain'],
    adjectives: ['Golden', 'Quiet', 'Green', 'Old', 'Plain', 'Fat'],
    nouns: ['Mill', 'Sheaf', 'Crow', 'Plough', 'Churn', 'Kettle', 'Barrow'],
    cityHeads: ['Great', 'Little', 'Long', 'Nether'],
    cityTails: ['Meadow', 'Barrow', 'Fields', 'Ford', 'Green', 'Bottom'],
  },
  plain: {},
}

/** Signs and names every town can use, before the flavour adds its own. */
const CORE_ADJECTIVES: readonly string[] = ['Rusty', 'Quiet', 'Broken', 'Golden', 'Last', 'Old', 'Iron', 'Salt', 'Copper', 'Grey', 'Bright', 'Crooked', 'Half', 'Fair']
const CORE_NOUNS: readonly string[] = ['Nail', 'Lantern', 'Anchor', 'Spur', 'Kettle', 'Wheel', 'Crow', 'Mill', 'Coin', 'Post', 'Thimble', 'Ladder', 'Sparrow', 'Cellar']
const CORE_HEADS: readonly string[] = ['New', 'Old', 'North', 'South', 'Little']
const CORE_TAILS: readonly string[] = ['Hollow', 'Crossing', 'Reach', 'Flats', 'Junction', 'Bend', 'Row', 'Mile']

const CACHE = new Map<Flavour, Words>()

/** The whole vocabulary a themed town names itself and its people from. */
export function wordsFor(flavour: Flavour): Words {
  const held = CACHE.get(flavour)
  if (held) return held
  const extra = EXTRA[flavour]
  const words: Words = {
    first: [...CORE_FIRST, ...(extra.first ?? [])],
    last: [...CORE_LAST, ...(extra.last ?? [])],
    adjectives: [...CORE_ADJECTIVES, ...(extra.adjectives ?? [])],
    nouns: [...CORE_NOUNS, ...(extra.nouns ?? [])],
    cityHeads: [...CORE_HEADS, ...(extra.cityHeads ?? [])],
    cityTails: [...CORE_TAILS, ...(extra.cityTails ?? [])],
  }
  CACHE.set(flavour, words)
  return words
}

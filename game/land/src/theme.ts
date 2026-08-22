/**
 * What a place is made of. A theme decides the light, the shape of the hills,
 * the colours of the ground, how much water there is and what grows on it.
 * Everything else in this box reads these numbers and nothing else.
 */
export interface LandTheme {
  readonly id: string
  /** Words that pick this theme out of a world's free-text theme. */
  readonly matches: readonly string[]

  readonly sky: {
    /** Degrees above the horizon, and degrees around it from north. */
    readonly sunElevation: number
    readonly sunAzimuth: number
    /** Preetham parameters: haze, blue depth, and the size and shape of the glow around the sun. */
    readonly turbidity: number
    readonly rayleigh: number
    readonly mie: number
    readonly mieDirection: number
    /** How much of the sky is cloud, how solid it is, and how big the shapes are. */
    readonly cloudCoverage: number
    readonly cloudDensity: number
    readonly cloudScale: number
    readonly cloudElevation: number
  }

  readonly light: {
    readonly sun: number
    readonly sunIntensity: number
    readonly skyColour: number
    readonly bounceColour: number
    readonly ambient: number
    /** Fog colour, where it starts biting and where it hides everything. */
    readonly haze: number
    readonly hazeNear: number
    readonly hazeFar: number
  }

  /** Metres. The shape of the ring, measured outward from the edge of the open ground. */
  readonly relief: {
    /** The flat-ish skirt the town sits in, and how much it lifts across it. */
    readonly skirt: number
    readonly skirtHeight: number
    /** Where the ring climbs, how high, how wide its top is and how far it takes to come down. */
    readonly climb: number
    readonly peak: number
    readonly crest: number
    readonly descent: number
    /** Height of the land beyond the ring, out to the horizon. */
    readonly plain: number
    /** Amplitude and size of the hills laid over the ring, and of the roughness over those. */
    readonly hills: number
    readonly hillScale: number
    readonly rough: number
    readonly roughScale: number
  }

  readonly ground: {
    readonly low: number
    readonly high: number
    readonly rock: number
    readonly snow: number
    /** Metres at which `low` has become `high`, and at which snow takes over. */
    readonly highAt: number
    readonly snowAt: number
    /** Slope, as a fraction, at which bare rock shows through. */
    readonly rockSlope: number
  }

  readonly water: {
    readonly count: number
    /** Metres: the reach of the basin carved for one pond, and how deep it goes. */
    readonly radius: number
    readonly depth: number
    readonly colour: number
    readonly opacity: number
  }

  readonly trees: {
    readonly species: readonly Species[]
    /** Metres between candidate positions, before thinning. */
    readonly spacing: number
    /** 0 to 1: how much of the woodland mask counts as wooded. */
    readonly density: number
    /** Nothing grows above this height, on a steeper slope than this, or beyond this far out. */
    readonly treeLine: number
    readonly maxSlope: number
    readonly reach: number
    readonly max: number
  }
}

export interface Species {
  readonly id: string
  readonly trunk: number
  readonly canopy: number
  /** Metres, before per-tree scaling. */
  readonly height: number
  readonly spread: number
  readonly shape: 'cone' | 'round' | 'bare'
  /** Relative share of the wood. */
  readonly share: number
}

const TEMPERATE: LandTheme = {
  id: 'temperate',
  matches: ['valley', 'meadow', 'forest', 'wood', 'alpine', 'green', 'farm', 'spring', 'quiet', 'market', 'hill'],
  sky: {
    sunElevation: 34,
    sunAzimuth: 140,
    turbidity: 4,
    rayleigh: 1.6,
    mie: 0.005,
    mieDirection: 0.8,
    cloudCoverage: 0.35,
    cloudDensity: 0.45,
    cloudScale: 0.00018,
    cloudElevation: 0.5,
  },
  light: {
    sun: 0xfff1d8,
    sunIntensity: 3.1,
    skyColour: 0xbcd6ec,
    bounceColour: 0x5d6a4a,
    ambient: 2.2,
    haze: 0xb9cbd8,
    hazeNear: 90,
    hazeFar: 1150,
  },
  relief: {
    skirt: 45,
    skirtHeight: 6,
    climb: 130,
    peak: 84,
    crest: 70,
    descent: 170,
    plain: 14,
    hills: 16,
    hillScale: 170,
    rough: 3,
    roughScale: 34,
  },
  ground: {
    low: 0x6f7d47,
    high: 0x59613c,
    rock: 0x6c665c,
    snow: 0xdfe4e8,
    highAt: 55,
    snowAt: 78,
    rockSlope: 0.6,
  },
  water: {
    count: 2,
    radius: 28,
    depth: 6,
    colour: 0x33566b,
    opacity: 0.86,
  },
  trees: {
    species: [
      { id: 'pine', trunk: 0x4c3a2a, canopy: 0x39572f, height: 9, spread: 2.6, shape: 'cone', share: 3 },
      { id: 'oak', trunk: 0x5a4531, canopy: 0x4d6b34, height: 7, spread: 3.4, shape: 'round', share: 2 },
    ],
    spacing: 8,
    density: 0.42,
    treeLine: 62,
    maxSlope: 0.85,
    reach: 260,
    max: 800,
  },
}

const ARID: LandTheme = {
  id: 'arid',
  matches: [
    'desert', 'dust', 'dusty', 'western', 'mining', 'mine', 'badlands', 'canyon',
    'arid', 'dry', 'frontier', 'mesa', 'prairie', 'gold', 'sand', 'sun-baked',
  ],
  sky: {
    sunElevation: 58,
    sunAzimuth: 200,
    turbidity: 8,
    rayleigh: 0.7,
    mie: 0.012,
    mieDirection: 0.86,
    cloudCoverage: 0.1,
    cloudDensity: 0.25,
    cloudScale: 0.00012,
    cloudElevation: 0.7,
  },
  light: {
    sun: 0xffe9bd,
    sunIntensity: 3.8,
    skyColour: 0xd6d2bd,
    bounceColour: 0x8a6b47,
    ambient: 2.0,
    haze: 0xd8c9a8,
    hazeNear: 140,
    hazeFar: 1500,
  },
  relief: {
    skirt: 70,
    skirtHeight: 5,
    climb: 150,
    peak: 96,
    crest: 55,
    descent: 200,
    plain: 18,
    hills: 20,
    hillScale: 210,
    rough: 4,
    roughScale: 28,
  },
  ground: {
    low: 0xa8875a,
    high: 0x8c6440,
    rock: 0x7b5b42,
    snow: 0xbfae92,
    highAt: 48,
    snowAt: 400,
    rockSlope: 0.42,
  },
  water: {
    count: 1,
    radius: 20,
    depth: 4,
    colour: 0x4a5a4a,
    opacity: 0.78,
  },
  trees: {
    species: [
      { id: 'scrub', trunk: 0x6b5637, canopy: 0x7a7b4c, height: 1.8, spread: 2.2, shape: 'round', share: 5 },
      { id: 'dead-pine', trunk: 0x6f5a41, canopy: 0x6f5a41, height: 5.5, spread: 1.2, shape: 'bare', share: 1 },
    ],
    spacing: 9,
    density: 0.4,
    treeLine: 44,
    maxSlope: 0.8,
    reach: 300,
    max: 520,
  },
}

const MARITIME: LandTheme = {
  id: 'maritime',
  matches: [
    'rain', 'rainy', 'port', 'harbour', 'harbor', 'coast', 'coastal', 'sea',
    'fishing', 'fog', 'foggy', 'wet', 'storm', 'dock', 'monsoon', 'island', 'soaked',
  ],
  sky: {
    sunElevation: 17,
    sunAzimuth: 250,
    turbidity: 14,
    rayleigh: 3,
    mie: 0.02,
    mieDirection: 0.7,
    cloudCoverage: 0.75,
    cloudDensity: 0.8,
    cloudScale: 0.00026,
    cloudElevation: 0.35,
  },
  light: {
    sun: 0xcfd8e0,
    sunIntensity: 1.5,
    skyColour: 0x93a5b2,
    bounceColour: 0x4a5147,
    ambient: 2.8,
    haze: 0x9fadb6,
    hazeNear: 45,
    hazeFar: 620,
  },
  relief: {
    skirt: 35,
    skirtHeight: 7,
    climb: 110,
    peak: 66,
    crest: 60,
    descent: 150,
    plain: 10,
    hills: 13,
    hillScale: 140,
    rough: 2.4,
    roughScale: 30,
  },
  ground: {
    low: 0x4c6142,
    high: 0x3d4f39,
    rock: 0x5b5f5e,
    snow: 0xc9d3d6,
    highAt: 40,
    snowAt: 300,
    rockSlope: 0.55,
  },
  water: {
    count: 3,
    radius: 30,
    depth: 7,
    colour: 0x2b4450,
    opacity: 0.9,
  },
  trees: {
    species: [
      { id: 'fir', trunk: 0x3f3428, canopy: 0x2c4630, height: 11, spread: 2.8, shape: 'cone', share: 4 },
      { id: 'alder', trunk: 0x4f4638, canopy: 0x3f5c3a, height: 6.5, spread: 3.2, shape: 'round', share: 3 },
    ],
    spacing: 6,
    density: 0.58,
    treeLine: 52,
    maxSlope: 0.95,
    reach: 220,
    max: 900,
  },
}

/** Every theme this box can build. Add one here and it is selectable everywhere. */
export const THEMES: readonly LandTheme[] = [TEMPERATE, ARID, MARITIME]

export const DEFAULT_THEME = TEMPERATE.id

/** A theme by id, or undefined when nothing is registered under that name. */
export function landTheme(id: string): LandTheme | undefined {
  return THEMES.find((theme) => theme.id === id)
}

/**
 * The theme whose words best fit a world's theme text. Ties and no match at all
 * both fall to the default, so any string a narrator invents still builds land.
 */
export function matchTheme(text: string): LandTheme {
  const words = text.toLowerCase()
  let best = landTheme(DEFAULT_THEME)!
  let bestScore = 0
  for (const theme of THEMES) {
    let score = 0
    for (const word of theme.matches) if (words.includes(word)) score++
    if (score > bestScore) {
      best = theme
      bestScore = score
    }
  }
  return best
}

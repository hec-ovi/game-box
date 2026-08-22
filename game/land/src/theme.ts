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
    /** Degrees the sun stands above the horizon at midday: how far south this place is. */
    readonly noonElevation: number
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
    /** Sun colour high in the sky and down at the horizon, and its strength at midday. */
    readonly sun: number
    readonly lowSun: number
    readonly sunIntensity: number
    /** Moon colour and its strength at its highest. */
    readonly moon: number
    readonly moonIntensity: number
    /** Sky and bounce colours and ambient strength, by day. */
    readonly skyColour: number
    readonly bounceColour: number
    readonly ambient: number
    /** The same three at night. Night is dimmer and bluer, never black. */
    readonly nightSky: number
    readonly nightBounce: number
    readonly nightAmbient: number
    /** Haze colour by day and by night, and how thick the air is per metre. */
    readonly haze: number
    readonly nightHaze: number
    readonly density: number
  }

  /** Metres. The shape of the land, measured outward from the edge of the built area. */
  readonly relief: {
    /** The open ground the town stands on, and the little it lifts across all of it. */
    readonly open: number
    readonly openLift: number
    /** Where the ring climbs, how high, how wide its top is and how far it takes to come down. */
    readonly climb: number
    readonly peak: number
    readonly crest: number
    readonly descent: number
    /** Height of the land beyond the ring, out to the horizon. */
    readonly plateau: number
    /** Three sizes of rolling laid over all of it: amplitude and wavelength of each. */
    readonly broad: number
    readonly broadScale: number
    readonly mid: number
    readonly midScale: number
    readonly fine: number
    readonly fineScale: number
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
    noonElevation: 52,
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
    lowSun: 0xff9d5e,
    sunIntensity: 3.1,
    moon: 0xa9c0dc,
    moonIntensity: 0.34,
    skyColour: 0xbcd6ec,
    bounceColour: 0x5d6a4a,
    ambient: 2.2,
    nightSky: 0x2b3c55,
    nightBounce: 0x141a20,
    nightAmbient: 0.78,
    haze: 0xb9cbd8,
    nightHaze: 0x1d2836,
    density: 0.00032,
  },
  relief: {
    open: 1500,
    openLift: 30,
    climb: 1400,
    peak: 470,
    crest: 500,
    descent: 1600,
    plateau: 150,
    broad: 34,
    broadScale: 620,
    mid: 16,
    midScale: 190,
    fine: 3.2,
    fineScale: 72,
  },
  ground: {
    low: 0x6f7d47,
    high: 0x59613c,
    rock: 0x6c665c,
    snow: 0xdfe4e8,
    highAt: 200,
    snowAt: 380,
    rockSlope: 0.6,
  },
  water: {
    count: 5,
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
    treeLine: 260,
    maxSlope: 0.85,
    reach: 1900,
    max: 3200,
  },
}

const ARID: LandTheme = {
  id: 'arid',
  matches: [
    'desert', 'dust', 'dusty', 'western', 'mining', 'mine', 'badlands', 'canyon',
    'arid', 'dry', 'frontier', 'mesa', 'prairie', 'gold', 'sand', 'sun-baked',
  ],
  sky: {
    noonElevation: 72,
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
    lowSun: 0xff8a45,
    sunIntensity: 3.8,
    moon: 0xb6c3d4,
    moonIntensity: 0.3,
    skyColour: 0xd6d2bd,
    bounceColour: 0x8a6b47,
    ambient: 2.0,
    nightSky: 0x24304a,
    nightBounce: 0x1a1712,
    nightAmbient: 0.7,
    haze: 0xd8c9a8,
    nightHaze: 0x1e2436,
    density: 0.00022,
  },
  relief: {
    open: 1900,
    openLift: 26,
    climb: 1500,
    peak: 540,
    crest: 420,
    descent: 1800,
    plateau: 190,
    broad: 40,
    broadScale: 760,
    mid: 19,
    midScale: 230,
    fine: 3.6,
    fineScale: 84,
  },
  ground: {
    low: 0xa8875a,
    high: 0x8c6440,
    rock: 0x7b5b42,
    snow: 0xbfae92,
    highAt: 220,
    snowAt: 2000,
    rockSlope: 0.42,
  },
  water: {
    count: 2,
    radius: 22,
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
    treeLine: 200,
    maxSlope: 0.8,
    reach: 2000,
    max: 2200,
  },
}

const MARITIME: LandTheme = {
  id: 'maritime',
  matches: [
    'rain', 'rainy', 'port', 'harbour', 'harbor', 'coast', 'coastal', 'sea',
    'fishing', 'fog', 'foggy', 'wet', 'storm', 'dock', 'monsoon', 'island', 'soaked',
  ],
  sky: {
    noonElevation: 38,
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
    lowSun: 0xe8a074,
    sunIntensity: 1.5,
    moon: 0x9fb4cc,
    moonIntensity: 0.36,
    skyColour: 0x93a5b2,
    bounceColour: 0x4a5147,
    ambient: 2.8,
    nightSky: 0x2a3746,
    nightBounce: 0x12161a,
    nightAmbient: 0.9,
    haze: 0x9fadb6,
    nightHaze: 0x1a222a,
    density: 0.00055,
  },
  relief: {
    open: 1200,
    openLift: 34,
    climb: 1100,
    peak: 380,
    crest: 450,
    descent: 1400,
    plateau: 110,
    broad: 28,
    broadScale: 540,
    mid: 14,
    midScale: 170,
    fine: 2.8,
    fineScale: 66,
  },
  ground: {
    low: 0x4c6142,
    high: 0x3d4f39,
    rock: 0x5b5f5e,
    snow: 0xc9d3d6,
    highAt: 150,
    snowAt: 320,
    rockSlope: 0.55,
  },
  water: {
    count: 7,
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
    treeLine: 230,
    maxSlope: 0.95,
    reach: 1800,
    max: 4000,
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

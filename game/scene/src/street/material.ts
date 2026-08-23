import * as THREE from 'three'
import {
  abs,
  acos,
  atan,
  cameraPosition,
  clamp,
  dot,
  float,
  fract,
  fwidth,
  max,
  mix,
  normalWorld,
  oneMinus,
  positionWorld,
  pow,
  reflect,
  saturate,
  smoothstep,
  sqrt,
  texture,
  uniform,
  vec2,
  vec3,
} from 'three/tsl'
import { MeshPhysicalNodeMaterial, type Node } from 'three/webgpu'
import { CANYON_MIPS } from './canyon.ts'
import { EDGE_RANGE, type StreetField } from './field.ts'
import { SURFACE } from './sizes.ts'

/** One shaded number, and a pair of them: what the helpers below pass about. */
type Shade = Node<'float'>
type Pair = Node<'vec2'>

/** What the street is made of once the grime is on it, before any light reaches it. */
const COLOUR = {
  /** Dry asphalt at night is nearly black and slightly cold. */
  asphalt: new THREE.Color(0.052, 0.056, 0.064),
  /** Concrete paving: a shade lighter, and warmer than the road. */
  paving: new THREE.Color(0.085, 0.086, 0.088),
  /** What dirt does to either of them. */
  dirt: new THREE.Color(0.028, 0.027, 0.026),
  /** And what water does: wet ground is about half as bright as the same ground dry. */
  soaked: 0.45,
} as const

/** How much of the surface underneath the film covers up when it is bone dry. */
const DRY_COVER = 0.72

/** How much of the canyon probe a soaked mirror gives back. */
const REFLECTION = 0.9

/** Dry asphalt still has a few percent of specular in it, and a lit street still shows in it. */
const DRY_SHEEN = 0.07

/**
 * Water reflects 2% of what is straight above it and most of what grazes it,
 * which is why a wet street is dark at your feet and bright in the distance.
 */
const WATER_F0 = 0.02

/** How far into the probe's mips a rough surface reads. Past this the whole probe averages to one colour. */
const BLUR = 2.6

/**
 * The skin the street wears: grime, aggregate, paving joints, road repairs and
 * standing water, in one material over the ground the dressing laid.
 *
 * It is one surface response rather than a stack of decals, because the same
 * numbers have to drive all of it: where the water pools is where the dirt
 * collects, and both are decided by how far a point is from the edge of the
 * paved surface. Everything is sized in real metres from `SURFACE`, and the
 * only thing that changes at runtime is how wet it is.
 */
export function streetMaterial(field: StreetField, noise: THREE.Texture, canyon: THREE.Texture): StreetSkinMaterial {
  const wet = uniform(0)
  const night = uniform(1)
  const material = new MeshPhysicalNodeMaterial()
  material.name = 'street:skin'
  material.transparent = true
  material.depthWrite = false
  material.metalness = 0
  material.side = THREE.FrontSide

  const here = positionWorld.xz
  const at = (metres: number) => here.div(metres)
  const grid = texture(field.texture, vec2(positionWorld.x.div(field.span.x), positionWorld.z.div(field.span.z)))

  // metres to the nearest edge of the paved surface, and which surface this is
  const edge = grid.r.mul(EDGE_RANGE)
  const pavement = grid.g
  const top = smoothstep(0.4, 0.85, normalWorld.y)

  const pools = texture(noise, at(SURFACE.pool)).r
  const stain = texture(noise, at(SURFACE.stain)).g
  const repair = texture(noise, at(SURFACE.repair)).b
  const grit = texture(noise, at(SURFACE.aggregate)).a

  // the gutter: everything gathers where the ground stops
  const gutter = oneMinus(smoothstep(0, SURFACE.gutterReach, edge))
  // two bands the wheels polish, one in from each kerb, on the roadway only
  const track = oneMinus(smoothstep(0, SURFACE.trackWidth, abs(edge.sub(SURFACE.trackInset)))).mul(oneMinus(pavement))

  const dirt = clamp(stain.mul(0.85).add(gutter.mul(0.65)).add(grit.mul(0.25)).sub(0.24), 0, 1)
  const patched = abs(repair.sub(0.5)).mul(oneMinus(pavement))

  // paving is laid in slabs and the kerb in stones; the road is not laid in anything
  const flags = joints(here, SURFACE.flag).mul(pavement).mul(top)
  const stones = joints(vec2(positionWorld.x.add(positionWorld.z), positionWorld.y), SURFACE.kerbStone).mul(oneMinus(top))
  const cut = max(flags, stones)

  const base = mix(vec3(COLOUR.asphalt.r, COLOUR.asphalt.g, COLOUR.asphalt.b), vec3(COLOUR.paving.r, COLOUR.paving.g, COLOUR.paving.b), pavement)
  const grimy = mix(base, vec3(COLOUR.dirt.r, COLOUR.dirt.g, COLOUR.dirt.b), dirt)
  const worn = grimy.mul(float(1).sub(patched.mul(0.5)).sub(track.mul(0.15)).add(grit.mul(0.12)))
  material.colorNode = worn.mul(mix(1, COLOUR.soaked, wet)).mul(oneMinus(cut.mul(0.55)))

  // dry it is matte, and dirt makes it matter; damp it sheens all over; a pool is a mirror
  // the pavement stands a kerb above the gutter, so it holds far less water,
  // and nothing at all stands on the face of a kerb
  const puddle = standingWater(pools, gutter, track, wet).mul(mix(1, 0.4, pavement)).mul(top)
  const dry = mix(0.93, 0.78, dirt).sub(track.mul(0.1)).add(grit.mul(0.18))
  const roughness = clamp(mix(mix(dry, float(0.36).add(grit.mul(0.2)), wet), 0.05, puddle), 0.04, 1)
  material.roughnessNode = roughness

  // how much of the dressing's own surface is left showing through
  material.opacityNode = clamp(float(DRY_COVER).add(dirt.mul(0.3)).add(wet.mul(0.18)).add(puddle.mul(0.9)), 0, 1)

  // and what it gives back of the lit street above it. Concrete paving stays
  // duller than asphalt however hard it rains, and only a face looking up
  // reflects the street at all: a kerb would otherwise be a vertical mirror
  const gloss = float(DRY_SHEEN).add(wet.mul(mix(0.32, 1, puddle))).mul(mix(1, 0.3, pavement)).mul(top).mul(REFLECTION)
  // and only after dark: by day the sky the app already lights the city with is
  // the right reflection, and a neon canyon over it would be a lie
  material.emissiveNode = reflected(canyon, roughness).mul(gloss).mul(night)

  return {
    material,
    setWetness: (wetness: number) => {
      wet.value = unit(wetness)
    },
    setNight: (darkness: number) => {
      night.value = unit(darkness)
    },
  }
}

export interface StreetSkinMaterial {
  readonly material: MeshPhysicalNodeMaterial
  /** 0 dry, 1 soaked. */
  setWetness(wetness: number): void
  /** 0 broad daylight, 1 after dark: how much of the neon canyon the street gives back. */
  setNight(darkness: number): void
}

/** A reading that is not a number between nothing and everything is no reading at all. */
export function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/**
 * What the surface gives back of the canyon above it: the reflected ray read
 * out of the probe, blurred by how rough the surface is at that point, and
 * strongest where the view grazes it, which is the far end of the street.
 */
function reflected(canyon: THREE.Texture, roughness: Shade): Node<'vec3'> {
  const eye = cameraPosition.sub(positionWorld).normalize()
  const ray = reflect(eye.negate(), normalWorld)
  const around = atan(ray.z, ray.x).mul(1 / (Math.PI * 2)).add(0.5)
  const down = acos(clamp(ray.y, -1, 1)).mul(1 / Math.PI)
  const fresnel = float(WATER_F0).add(pow(oneMinus(saturate(dot(normalWorld, eye))), 5).mul(1 - WATER_F0))
  return texture(canyon, vec2(around, down))
    .level(clamp(sqrt(roughness).mul(BLUR), 0, CANYON_MIPS - 3))
    .rgb.mul(fresnel)
}

/**
 * Water pools in the gutter first, then in the wheel tracks, and only covers
 * the crown of the road when it is really coming down. Nothing at all when dry.
 */
function standingWater(pools: Shade, gutter: Shade, track: Shade, wet: Shade): Shade {
  const low = pools.add(gutter.mul(0.2)).add(track.mul(0.1))
  const level = mix(1.4, 0.68, wet)
  return smoothstep(level, level.add(0.04), low).mul(smoothstep(0, 0.15, wet))
}

/** The dark line where two slabs meet, kept a pixel wide however far away it is. */
function joints(along: Pair, size: number): Shade {
  const cell = along.div(size)
  const edge = abs(fract(cell).sub(0.5))
  const half = float(0.5).sub(SURFACE.joint / size)
  const blur = max(fwidth(cell.x), fwidth(cell.y)).add(0.001)
  return smoothstep(half.sub(blur), half, max(edge.x, edge.y))
}

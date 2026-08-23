import type { Rng } from '@gb/kit'
import * as THREE from 'three'

/** How many stars are hung on the night sky. */
const STARS = 1200

/** Share of them that belong to the galaxy's band rather than to the open sky. */
const IN_BAND = 0.55
/** How far off the galactic plane a band star strays, as a sine of the angle. */
const BAND_SPREAD = 0.17

/** Share of them that are warm rather than blue-white, which is about what a real sky shows. */
const WARM = 0.18

/**
 * Drawn before anything else that blends, because nothing in the world is
 * further away than a star. It is an order inside the blended pass, not a way
 * out of the depth buffer.
 */
const STAR_ORDER = -999

/**
 * Points on a sphere, in whites, cold blues and a few ambers, one draw for the
 * whole sky.
 *
 * Over half of them lie along the galaxy's band, which is the same band the
 * dome paints behind them: the wash gives it colour and dust, the points give
 * it the grain a texel cannot hold at this size, and together they read as one
 * thing rather than as dots over a smear.
 *
 * The sphere is built around its own origin: whoever hangs it puts that origin
 * on the eye, so the observer is always at the centre of it.
 */
export function buildStars(reach: number, pole: THREE.Vector3, rng: Rng): THREE.Points {
  const positions = new Float32Array(STARS * 3)
  const colours = new Float32Array(STARS * 3)
  const shade = new THREE.Color()
  const along = new THREE.Vector3(0, 1, 0).cross(pole)
  if (along.lengthSq() < 1e-6) along.set(1, 0, 0)
  along.normalize()
  const across = new THREE.Vector3().crossVectors(pole, along).normalize()
  const place = new THREE.Vector3()

  for (let star = 0; star < STARS; star++) {
    if (rng.chance(IN_BAND)) {
      // scattered round the galactic plane, thickest on it
      const turn = rng.float() * Math.PI * 2
      const off = (rng.float() + rng.float() - 1) * BAND_SPREAD
      const ring = Math.sqrt(Math.max(0, 1 - off * off))
      place
        .copy(along)
        .multiplyScalar(Math.cos(turn) * ring)
        .addScaledVector(across, Math.sin(turn) * ring)
        .addScaledVector(pole, off)
    } else {
      // even over the sphere, then only the half above the horizon is ever seen
      const height = rng.range(-0.15, 1)
      const ring = Math.sqrt(Math.max(0, 1 - height * height))
      const angle = rng.float() * Math.PI * 2
      place.set(Math.cos(angle) * ring, height, Math.sin(angle) * ring)
    }
    positions[star * 3] = place.x * reach
    positions[star * 3 + 1] = place.y * reach
    positions[star * 3 + 2] = place.z * reach

    // a real sky is a handful of bright stars over a wash of faint ones, so
    // brightness is cubed: most of these land near the bottom of the range
    const magnitude = rng.float()
    const hue = rng.chance(WARM) ? rng.range(0.04, 0.11) : rng.range(0.55, 0.66)
    shade.setHSL(hue, rng.range(0, 0.4), 0.1 + 0.9 * magnitude ** 3)
    colours[star * 3] = shade.r
    colours[star * 3 + 1] = shade.g
    colours[star * 3 + 2] = shade.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      // starlight adds to the sky rather than covering it, which is what makes
      // the faint end of the distribution read as faint
      blending: THREE.AdditiveBlending,
      transparent: true,
      // blended, so this draws after every solid thing in the frame: it has to
      // depth-test or it paints over walls, cars and people
      depthTest: true,
      depthWrite: false,
      fog: false,
    }),
  )
  stars.name = 'land:stars'
  stars.renderOrder = STAR_ORDER
  stars.frustumCulled = false
  return stars
}

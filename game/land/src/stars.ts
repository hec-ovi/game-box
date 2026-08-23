import type { Rng } from '@gb/kit'
import * as THREE from 'three'

/** How many stars are hung on the night sky. */
const STARS = 1200

/**
 * Drawn before anything else that blends, because nothing in the world is
 * further away than a star. It is an order inside the blended pass, not a way
 * out of the depth buffer.
 */
const STAR_ORDER = -999

/** Points on a sphere, in whites and cold blues, one draw for the whole sky. */
export function buildStars(centre: THREE.Vector3, reach: number, rng: Rng): THREE.Points {
  const positions = new Float32Array(STARS * 3)
  const colours = new Float32Array(STARS * 3)
  const shade = new THREE.Color()
  for (let star = 0; star < STARS; star++) {
    // even over the sphere, then only the half above the horizon is ever seen
    const height = rng.range(-0.15, 1)
    const ring = Math.sqrt(Math.max(0, 1 - height * height))
    const angle = rng.float() * Math.PI * 2
    positions[star * 3] = Math.cos(angle) * ring * reach
    positions[star * 3 + 1] = height * reach
    positions[star * 3 + 2] = Math.sin(angle) * ring * reach

    // a real sky is a handful of bright stars over a wash of faint ones, so
    // brightness is cubed: most of these land near the bottom of the range
    const magnitude = rng.float()
    shade.setHSL(rng.range(0.55, 0.66), rng.range(0, 0.35), 0.1 + 0.9 * magnitude ** 3)
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
  stars.position.copy(centre)
  stars.renderOrder = STAR_ORDER
  stars.frustumCulled = false
  return stars
}

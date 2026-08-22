import * as THREE from 'three'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import type { LandTheme } from './theme.ts'

export interface Atmosphere {
  readonly sky: THREE.Object3D
  readonly sun: THREE.DirectionalLight
  readonly skyLight: THREE.HemisphereLight
  readonly fog: THREE.Fog
}

/**
 * Sky, sun and haze, all from the theme.
 *
 * The skydome is the Preetham daylight model with clouds, drawn before
 * everything else and never written to the depth buffer, so it sits behind the
 * land whatever the camera's far plane is. It is a node material, which is what
 * the WebGPU renderer needs and what its WebGL2 backend compiles for itself.
 */
export function buildAtmosphere(theme: LandTheme, centre: { x: number; z: number }, radius: number): Atmosphere {
  const dome = new SkyMesh()
  dome.name = 'land:sky'
  dome.scale.setScalar(radius * 2)
  dome.position.set(centre.x, 0, centre.z)
  dome.renderOrder = -1000
  dome.material.fog = false
  dome.material.depthTest = false

  const settings = theme.sky
  dome.turbidity.value = settings.turbidity
  dome.rayleigh.value = settings.rayleigh
  dome.mieCoefficient.value = settings.mie
  dome.mieDirectionalG.value = settings.mieDirection
  dome.cloudCoverage.value = settings.cloudCoverage
  dome.cloudDensity.value = settings.cloudDensity
  dome.cloudScale.value = settings.cloudScale
  dome.cloudElevation.value = settings.cloudElevation

  const sunDirection = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - settings.sunElevation),
    THREE.MathUtils.degToRad(settings.sunAzimuth),
  )
  dome.sunPosition.value.copy(sunDirection)

  const sun = new THREE.DirectionalLight(theme.light.sun, theme.light.sunIntensity)
  sun.name = 'land:sun'
  sun.position.set(centre.x + sunDirection.x * 400, sunDirection.y * 400, centre.z + sunDirection.z * 400)
  sun.target.name = 'land:sun-target'
  sun.target.position.set(centre.x, 0, centre.z)

  const skyLight = new THREE.HemisphereLight(theme.light.skyColour, theme.light.bounceColour, theme.light.ambient)
  skyLight.name = 'land:skylight'

  const fog = new THREE.Fog(theme.light.haze, theme.light.hazeNear, theme.light.hazeFar)
  return { sky: dome, sun, skyLight, fog }
}
